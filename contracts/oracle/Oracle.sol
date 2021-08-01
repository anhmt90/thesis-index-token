//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../IndexFund.sol";

contract Oracle is Ownable {

    address public indexFund;

    // <componentToken_name> is at <componentToken_address>
    address[] public componentAddrs;
    string[] public componentNames;
    string[] public componentITCs;

    constructor(address owner) {
        transferOwnership(owner);
        indexFund = msg.sender;
    }

    function prepare(
        string[] calldata _componentNames,
        address[] calldata _componentAddrs,
        string[] calldata _componentITCs,
        string calldata _announcementMessage
    ) external onlyOwner {
        require(_componentNames.length == _componentAddrs.length, "Oracle: NAME and ADDRESS arrays not equal in length!");
        require(_componentNames.length == _componentITCs.length, "Oracle: NAME and ITC arrays not equal in length!");
        componentNames = _componentNames;
        componentITCs = _componentITCs;

        for (uint256 i = 0; i < _componentNames.length; i++) {
            require(_componentAddrs[i] != address(0), "Oracle: a component address is 0");
        }
        componentAddrs = _componentAddrs;

        IndexFund(indexFund).announcePortfolioUpdating(_announcementMessage);
    }

    function finalize() external onlyOwner {
        IndexFund(indexFund).setPorfolio(componentNames, componentAddrs);
    }
}
