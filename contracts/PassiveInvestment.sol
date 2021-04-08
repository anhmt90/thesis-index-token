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

    uint256 constant MAX_UINT256 = 2**256 - 1;

    // instance of the ERC20 Index Token contract
    IndexToken public tokenContract = IndexToken(address(0));

    // instance of the price Oracle contract
    Oracle public oracleContract = Oracle(address(0));

    // set of pending purchases that are yet to finalize
    mapping(uint256 => Purchase) pendingPurchases;

    // <token_itin> is set at <price> in Ether
    // mapping(bytes32 => uint256) public portfolio;

    // keep track of the token amount sold out to the market
    uint256 public tokensSold;

    event PriceRequest(uint256 indexed _reqId, address indexed _buyer);
    event PurchaseReady(uint256 indexed _reqId, address indexed _buyer, uint256 _price);
    event Purchased(
        uint256 indexed _reqId,
        address indexed _buyer,
        uint256 _amount,
        uint256 _price
    );

    constructor(IndexToken _tokenContract, Oracle _oracleContract) {
        tokenContract = _tokenContract;
        oracleContract = _oracleContract;
    }

    // payable: function can exec Tx
    function orderTokens(uint256 _numberOfTokens) public payable {
        uint256 _reqId = assignRequestId();

        pendingPurchases[_reqId] = Purchase(
            _reqId,
            msg.sender,
            _numberOfTokens,
            MAX_UINT256
        );

        oracleContract.request(_reqId);

        // emit PriceRequest(_reqId, msg.sender);
    }

    // @notice a callback for Oracle contract to call once the requested data is ready
    function __oracleCallback(uint256 _reqId, uint256 _price)
        external
        override
        returns (bool)
    {
        require(pendingPurchases[_reqId]._id != 0, "Request ID not found");

        pendingPurchases[_reqId]._price = _price;

        emit PurchaseReady(_reqId, pendingPurchases[_reqId]._buyer, _price);
        // finalize(_reqId);

        return true;
    }

    function finalize(uint256 _reqId) public payable returns (bool)  {
        // require that the request Id passed in is available
        require(pendingPurchases[_reqId]._id != 0, "Request ID not found");

        // require that the function caller is the buyer placing token order earlier with this _reqId
        require(pendingPurchases[_reqId]._buyer == msg.sender, "Unauthorized purchase claim");

        // require that the contract has enough tokens
        require(tokenContract.balanceOf(address(this)) >= pendingPurchases[_reqId]._numberOfTokens, "Unable to purchase more tokens than totally available");

        // require that actual price has been queried and received from the oracle
        require(pendingPurchases[_reqId]._price != MAX_UINT256, "Price is yet to set");

        // require that the calling entity has enough funds to buy tokens
        require(msg.value == (pendingPurchases[_reqId]._numberOfTokens * pendingPurchases[_reqId]._price), "Not enough funds to buy tokens");

        // require that a transfer is successful
        require(tokenContract.transfer(msg.sender, pendingPurchases[_reqId]._numberOfTokens), "Unable to transfer tokens to buyer");

        tokensSold += pendingPurchases[_reqId]._numberOfTokens;

        emit Purchased(
            _reqId,
            msg.sender,
            pendingPurchases[_reqId]._numberOfTokens,
            pendingPurchases[_reqId]._price
        );

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

    function setTokenContract(address _tokenContract) external onlyOwner returns (bool) {
        tokenContract = IndexToken(_tokenContract);
        return true;
    }

    function setOracle(address _oracleContract) override external onlyOwner returns (bool) {
        oracleContract = Oracle(_oracleContract);
        return true;
    }

}
