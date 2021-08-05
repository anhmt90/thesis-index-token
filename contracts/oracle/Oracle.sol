//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../IndexFund.sol";
import "../TimeLock.sol";

contract Oracle is Ownable {

    address public indexFund;

    string[] public componentSymbolsOut;
    address[] public componentAddrsIn;
    string[] public allNextComponentSymbols;
    string[] public componentITINs;


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

    function announce(
        string[] memory _componentSymbolsOut,
        address[] memory _componentAddrsIn,
        string[] memory _allNextComponentSymbols,
        string[] memory _componentITINs,
        string calldata _announcementMessage
    ) external onlyOwner onlyFundOwner {
        require(_componentSymbolsOut.length == _componentAddrsIn.length, "Oracle: number of component to be added and to be removed not matched");

        componentSymbolsOut = _componentSymbolsOut;
        componentAddrsIn = _componentAddrsIn;
        allNextComponentSymbols = _allNextComponentSymbols;
        componentITINs = _componentITINs;

        IndexFund(indexFund).announcePortfolioUpdating(_announcementMessage);
    }

    function commit(uint256[] calldata _amountsOutMinOut, uint256[] calldata _amountsOutMinIn) external onlyOwner onlyFundOwner {
        IndexFund(indexFund).updatePorfolio(
            componentSymbolsOut,
            _amountsOutMinOut,
            componentAddrsIn,
            _amountsOutMinIn,
            allNextComponentSymbols
        );
    }

    function getNextUpdateTime() external view returns(uint256 _date) {
        return IndexFund(indexFund).timelock(TimeLock.Functions.UPDATE_PORTFOLIO);
    }
}
