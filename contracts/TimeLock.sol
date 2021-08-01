//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 *  @dev Specification for contracts using time lock
 *
 *  Adapted from https://medium.com/cryptexfinance/how-to-create-time-locked-functions-523424def80
 *
 */
abstract contract TimeLock {
    enum Functions {
        SET_PORTFOLIO,
        REBALANCING
    }
    uint256 public constant TIMELOCK = 2 days;
    mapping(Functions => uint256) public timelock;

    event TimeLockAnnouncement(
        Functions indexed _fn,
        uint256 indexed _due,
        string _message
    );

    modifier notLocked(Functions _fn) {
        require(timelock[_fn] != 0 && timelock[_fn] <= block.timestamp, "TimeLock: function is timelocked");
        _;
    }

    function lockUnlimited(Functions _fn) internal {
        timelock[_fn] = 0;
        emit TimeLockAnnouncement(Functions.SET_PORTFOLIO, 0, "");
    }

    function lock2days(Functions _fn, string calldata _message) internal {
        timelock[_fn] = block.timestamp + TIMELOCK;
        emit TimeLockAnnouncement(
            Functions.SET_PORTFOLIO,
            timelock[_fn],
            _message
        );
    }
}
