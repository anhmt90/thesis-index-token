//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IOracle {

    /// @notice get the aggregated price of all component tokens in the portfolio
    function request() external;

    function respond(uint256 reqId, uint256 price) external;

    /// @notice get the status of data request by its id
    /// @return RequestStatus
    function getRequestStatus(uint256 reqId) external view returns(RequestStatus);

    function isTrusted(address oracleServer) external returns (bool);

    function addOracleServer() external returns (bool);

    function removeOracleServer() external returns (bool);

}