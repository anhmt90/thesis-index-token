//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../IndexFund.sol";

contract Oracle is Ownable {

    address public indexFund;

    // <componentToken_name> is at <componentToken_address>

    string[] public componentSymbolsOut;
    address[] public componentAddrsIn;
    string[] public allNextComponentSymbols;
    string[] public componentITCs;


    constructor(address owner) {
        transferOwnership(owner);
        indexFund = msg.sender;
    }

    /**
     * @dev Throws if called by any account other than the owner of IndexFund.
     */
    modifier onlyFundOwner() {
        require(owner() == IndexFund(indexFund).owner(), "Oracle: caller is not the owner of IndexFund");
        _;
    }

    function prepare(
        string[] memory _componentSymbolsOut,
        address[] memory _componentAddrsIn,
        string[] memory _allNextComponentSymbols,
        string[] memory _componentITCs,
        string calldata _announcementMessage
    ) external onlyOwner onlyFundOwner {
        require(_componentSymbolsOut.length == _componentAddrsIn.length, "Oracle: number of component to be added and to be removed not matched");

        componentSymbolsOut = _componentSymbolsOut;
        componentAddrsIn = _componentAddrsIn;
        allNextComponentSymbols = _allNextComponentSymbols;
        componentITCs = _componentITCs;

        IndexFund(indexFund).announcePortfolioUpdating(_announcementMessage);
    }

    function apply_(uint256[] calldata _amountsOutMinOut, uint256[] calldata _amountsOutMinIn) external onlyOwner onlyFundOwner {
        IndexFund(indexFund).updatePorfolio(
            componentSymbolsOut,
            _amountsOutMinOut,
            componentAddrsIn,
            _amountsOutMinIn,
            allNextComponentSymbols
        );
    }
}
