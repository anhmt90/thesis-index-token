//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IOracle.sol";
import "./IOracleClient.sol";

contract Oracle is Ownable {
    enum RequestStatus {
        None, // request not available
        Underway // processed at Oracle node
        // Accomplished // result received from Oracle node and sent back to client
    }

    mapping(address => bool) trustedServers;
    mapping(address => bool) trustedClients;

    mapping(uint256 => address) pendingRequestRecords;
    mapping(uint256 => RequestStatus) requestStatus;

    event PriceRequest(uint256 _reqId);
    event PriceResponse(uint256 _reqId, uint256 _price);

    constructor(address server) {
        trustedServers[server] = true;
    }

    modifier onlyTrustedServers() {
        require(isTrustedServer(msg.sender), "Not a trusted Oracle Server");
        _;
    }

    modifier onlyTrustedClients() {
        require(isTrustedClient(msg.sender), "Not a trusted Oracle Client");
        _;
    }

    function isTrustedServer(address serverAddress) public view returns (bool) {
        return trustedServers[serverAddress];
    }

    function isTrustedClient(address clientAddress) public view returns (bool) {
        return trustedClients[clientAddress];
    }

    function request(uint256 _reqId) external payable onlyTrustedClients {
        // associate the reqId with the address of the caller for later callback using respond() function
        pendingRequestRecords[_reqId] = msg.sender;

        // change to approriate RequestStatus
        requestStatus[_reqId] = RequestStatus.Underway;

        // emit event for off-chain Oracle Servers to start processing the price request
        emit PriceRequest(_reqId);
    }

    /// @notice get the aggregated price of all component tokens in the portfolio
    /// @dev this function is only called by a trusted Oracle Server
    function respond(uint256 _reqId, uint256 _price)
        external
        onlyTrustedServers
    {
        require(
            pendingRequestRecords[_reqId] != address(0),
            "Request ID not found"
        );

        address clientAddress = pendingRequestRecords[_reqId];

        IOracleClient(clientAddress).__oracleCallback(_reqId, _price);

        requestStatus[_reqId] = RequestStatus.None;

        delete pendingRequestRecords[_reqId];

        emit PriceResponse(_reqId, _price);
    }

    function getRequestStatus(uint256 _reqId)
        external
        view
        returns (RequestStatus)
    {
        return requestStatus[_reqId];
    }

    function addserver(address server) external onlyOwner returns (bool) {
        trustedServers[server] = true;
        return trustedServers[server];
    }

    function removeserver(address server) external onlyOwner returns (bool) {
        trustedServers[server] = false;
        return trustedServers[server];
    }

    function addClient(address client) external onlyOwner returns (bool) {
        trustedClients[client] = true;
        return trustedClients[client];
    }

    function removeClient(address client) external onlyOwner returns (bool) {
        trustedClients[client] = false;
        return trustedClients[client];
    }
}
