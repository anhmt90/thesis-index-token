//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../IndexFund.sol";
import "../TimeLock.sol";

contract Oracle is Ownable {

    address payable public indexFund;

    string[] public componentSymbolsOut;
    address[] public componentAddrsIn;
    string[] public allNextComponentSymbols;
    string[] public componentITINs;
    string public announcementMessage;


    // constructor (address payable _indexFund) {
    //     indexFund = _indexFund;
    // }


    function announceUpdate(
        string[] memory _componentSymbolsOut,
        address[] memory _componentAddrsIn,
        string[] memory _allNextComponentSymbols,
        string[] memory _componentITINs,
        string memory _announcementMessage
    ) external onlyOwner {
        require(_componentSymbolsOut.length > 0, "Oracle: no components will be replaced");
        require(_componentSymbolsOut.length == _componentAddrsIn.length, "Oracle: number of component to be added and to be removed not matched");
        require(_allNextComponentSymbols.length > 0, "Oracle: an empty portfolio is now allowed");

        for (uint256 i = 0; i < _componentAddrsIn.length; i++) {
            require(_componentAddrsIn[i] != address(0), "Oracle: new address is 0");
        }

        componentSymbolsOut = _componentSymbolsOut;
        componentAddrsIn = _componentAddrsIn;
        allNextComponentSymbols = _allNextComponentSymbols;
        componentITINs = _componentITINs;
        announcementMessage = _announcementMessage;

        IndexFund(indexFund).announcePortfolioUpdating(_announcementMessage);
    }

    function commitUpdate(uint256[] calldata _amountsOutMinOut, uint256[] calldata _amountsOutMinIn) external onlyOwner {
        require(componentSymbolsOut.length == _amountsOutMinOut.length, "Oracle: length of _componentSymbolsOut and _amountsOutMinOut not matched");
        require(componentAddrsIn.length == _amountsOutMinIn.length, "Oracle: length of _componentAddrsIn and _amountsOutMinIn not matched");

        IndexFund(indexFund).updatePorfolio(
            componentSymbolsOut,
            _amountsOutMinOut,
            componentAddrsIn,
            _amountsOutMinIn,
            allNextComponentSymbols
        );
    }

    function announceRebalancing(string calldata _announcementMessage) external onlyOwner {
        IndexFund(indexFund).announcePortfolioRebalancing(_announcementMessage);
    }

    function commitRebalancing(
        uint256[] calldata _amountsETHOutMin,
        uint256[] calldata _amountsCpntOutMin)
    external onlyOwner {
        require(_amountsETHOutMin.length == _amountsCpntOutMin.length, "Oracle: length of _amountsETHOutMin and _amountsCpntOutMin not matched");
        require(_amountsETHOutMin.length == _amountsCpntOutMin.length, "Oracle: length of _amountsETHOutMin and _amountsCpntOutMin not matched");

        IndexFund(indexFund).rebalance(_amountsETHOutMin, _amountsCpntOutMin);
    }


    function getDueTime(TimeLock.Functions _fn) external view returns(uint256 _date) {
        return IndexFund(indexFund).timelock(_fn);
    }

    function getComponentSymbolsOut() public view returns(string[] memory) {
        return componentSymbolsOut;
    }

    function getComponentAddrsIn() public view returns(address[] memory) {
        return componentAddrsIn;
    }

    function getAllNextComponentSymbols() public view returns(string[] memory) {
        return allNextComponentSymbols;
    }

    function getComponentITINs() public view returns(string[] memory) {
        return componentITINs;
    }

    function setIndexFund(address _indexFund) public {
        indexFund = payable(_indexFund);
    }
}
