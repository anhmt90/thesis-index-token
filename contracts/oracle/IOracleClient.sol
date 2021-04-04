//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


abstract contract IOracleClient {
    uint256 private reqId = 0;

    function assignRequestId() private returns (uint256) {
        reqId += 1;
        return reqId;
    }

    // @notice a callback for Oracle contract to call, once the requested data is ready
    function oracleCallback(uint256 _reqId, uint256 _price) external virtual returns (bool);

    // @notice use this function to set the address of the Oracle contract for the Oracle client
    function setOracleAddress(address _oracleContract) external virtual returns (bool);

}