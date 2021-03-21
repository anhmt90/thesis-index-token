//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;


import "../openzeppelin/contracts/access/Ownable.sol";
import "./IndexToken.sol";

contract PassiveInvestment is Ownable {
    // address payable private owner; // admin address should NOT be exposed
    
    // address of the ERC20 IndexToken contract
    IndexToken public tokenContract;
    
    // <token_itin> is set at <price> in Ether
    mapping(bytes32 => uint256) public portfolio;
    
    // current price
    uint256 public tokenPrice;
    
    // keep track of the token amount sold out to the market
    uint256 public tokensSold;

    event Sell(address _buyer, uint256 _amount);

    constructor (IndexToken _tokenContract, uint256 _tokenPrice) {
        tokenContract = _tokenContract;
        tokenPrice = _tokenPrice;
    }


    // payable: function can exec Tx
    function buyTokens(uint256 _numberOfTokens) public payable {
        // require that the calling entity has enough funds to buy tokens
        require(msg.value == (_numberOfTokens * tokenPrice), "Not enough funds to buy tokens");
        
        // require that the contract has enough tokens
        require(tokenContract.balanceOf(address(this)) >= _numberOfTokens, "Unable to purchase more tokens than totally available");
        
        // require that a transfer is successful
        require(tokenContract.transfer(msg.sender, _numberOfTokens), "Unable to transfer tokens to buyer");

        tokensSold += _numberOfTokens;

        emit Sell(msg.sender, _numberOfTokens);

    }

    //Ending Token DappTokenSale
    function endSale() public onlyOwner {
        // transfer remaining dapp tokens to admin
        require(tokenContract.transfer(payable(owner()), tokenContract.balanceOf(address(this))), "Unsold tokens not correctly returned to owner");

        // destroy contract
        // the code of the contract on blockchain doesn't really get destroyed since 
        // it's immutable. But the contract will be `disable` and its state variables
        // will be set the default value of their datatype.
        selfdestruct(payable(owner()));
    }
    
    
}