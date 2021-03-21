//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;


import "../openzeppelin/contracts/token/ERC20/IERC20.sol";

contract IndexToken is IERC20 {
    string public name = "Index Token";
    string public symbol = "IT";
    
    string public decimals = "18";

    uint256 public override totalSupply;
    
    // responsible for keeping track of the tokens on the network
    // <token_owner> owns <token_amount>
    mapping(address => uint256) public override balanceOf;

    // <token_owner> allows <spender> to spend <token_amount>
    mapping(address => mapping(address => uint256)) public override allowance;
    
    

    constructor(uint256 _initialSupply) {
        // allocate the initial suplly
        balanceOf[msg.sender] = _initialSupply;
        totalSupply = _initialSupply;
    }


    function transfer(address _to, uint256 _amount)
        public
        override
        returns (bool success)
    {
        require(balanceOf[msg.sender] >= _amount, "Not enough balance");
        balanceOf[msg.sender] -= _amount;
        balanceOf[_to] += _amount;

        emit Transfer(msg.sender, _to, _amount);
        return true;
    }
    
    
    // A 3rd party (msg.sender) approved earlier (using approve()) could now transfer funds on behalf of the token owner 
    function transferFrom(address _from, address _to, uint256 _amount) 
        public 
        override
        returns (bool success) 
    {
        require(_amount <= balanceOf[_from], "Not enough token in source account");
        require(_amount <= allowance[_from][msg.sender], "Not enough approved token available");
        balanceOf[_from] -= _amount;
        balanceOf[_to] += _amount;

        allowance[_from][msg.sender] -= _amount;

        emit Transfer(_from, _to, _amount);
        return true;
    }
    
    

    // Delegated transfer
    function approve(address _spender, uint256 _amount)
        public
        override
        returns (bool success)
    {
        require(allowance[msg.sender][_spender] == 0, "Current allowance is not 0");
        allowance[msg.sender][_spender] = _amount;
        emit Approval(msg.sender, _spender,  _amount);
        return true;
    }
    
}