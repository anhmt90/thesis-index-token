//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract IndexToken is ERC20, Ownable {

    modifier onlyContract() {
        address _addr = msg.sender;
        uint32 size;
        assembly {
            size := extcodesize(_addr)
        }
        require(size > 0, "IndexToken: caller must be a contract");
        _;
    }

    constructor() ERC20("Index Token", "INXT") {  }

    function mint(address _to, uint256 _amount) onlyOwner external returns (bool) {
        _mint(_to, _amount);
        return true;
    }

    function burn(uint256 _amount) external returns (bool) {
        // can only burn the tokens that the caller owns
        _burn(msg.sender, _amount);
        return true;
    }
}