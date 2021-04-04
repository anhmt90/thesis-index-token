//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IndexToken.sol";
import "./oracle/IOracleClient.sol";
import "./oracle/Oracle.sol";

contract PassiveInvestment is Ownable, IOracleClient {
    struct Purchase {
        uint256 _id;
        address _buyer;
        uint256 _numberOfTokens;
        uint256 _price;
    }

    uint256 constant MAX_UINT256 = uint256(-1);

    // address of the ERC20 IndexToken contract
    IndexToken private tokenContract = IndexToken(address(0));
    Oracle private oracleContract = Oracle(address(0));

    mapping(uint256 => Purchase) pendingPurchases;

    // <token_itin> is set at <price> in Ether
    // mapping(bytes32 => uint256) public portfolio;

    // keep track of the token amount sold out to the market
    uint256 public tokensSold;

    event Sale(
        uint256 indexed _reqId,
        address indexed _buyer,
        uint256 _amount,
        uint256 _price
    );
    event PriceRequest(uint256 indexed _reqId, address indexed _buyer);
    event PurchaseReady(uint256 indexed _reqId, address indexed _buyer);

    constructor(IndexToken _tokenContract, Oracle _oracleContract) {
        tokenContract = _tokenContract;
        oracleContract = _oracleContract;
    }

    // payable: function can exec Tx
    function orderTokens(uint256 _numberOfTokens) public {
        uint256 _reqId = assignRequestId();

        pendingPurchases[_reqId] = Purchase(
            _reqId,
            msg.sender,
            _numberOfTokens,
            MAX_UINT256
        );

        oracleContract.request(_reqId);

        emit PriceRequest(_reqId, msg.sender);
    }

    function purchase(uint256 _reqId) public payable returns (bool)  {
        // require that the request Id passed in is available
        require(pendingPurchases[_reqId]._id != 0, "Request ID not found");

        // require that the function caller is the buyer that placed token order earlier
        require(pendingPurchases[_reqId]._buyer == msg.sender, "Unauthorized purchase claim");

        // require that the contract has enough tokens
        require(tokenContract.balanceOf(address(this)) >= _numberOfTokens, "Unable to purchase more tokens than totally available");

        // require that actual price has been queried and received from the oracle
        require(pendingPurchases[_reqId]._price != MAX_UINT256, "Price is yet to set");

        // require that the calling entity has enough funds to buy tokens
        require(msg.value == (pendingPurchases[_reqId]._numberOfTokens * pendingPurchases[_reqId]._price), "Not enough funds to buy tokens");

        // require that a transfer is successful
        require(tokenContract.transfer(msg.sender, _numberOfTokens), "Unable to transfer tokens to buyer");

        tokensSold += _numberOfTokens;

        emit Sale(msg.sender, pendingPurchases[_reqId]._numberOfTokens, pendingPurchases[_reqId]._price);

        return true;
    }

    //Ending Token DappTokenSale
    function endSale() public onlyOwner {
        // transfer remaining dapp tokens to admin
        require(
            tokenContract.transfer(
                payable(owner()),
                tokenContract.balanceOf(address(this))
            ),
            "Unsold tokens not correctly returned to owner"
        );

        // destroy contract
        // the code of the contract on blockchain doesn't really get destroyed since
        // it's immutable. But the contract will be `disable` and its state variables
        // will be set the default value of their datatype.
        selfdestruct(payable(owner()));
    }

    // @notice a callback for Oracle contract to call once the requested data is ready
    function oracleCallback(uint256 _reqId, uint256 _price)
        external
        override
        returns (bool)
    {
        Purchase memory _purchase = pendingPurchases[_reqId];
        _purchase._price = _price;
        delete pendingPurchases[_reqId];

        emit PurchaseReady(_reqId, _buyer);
    }
}
