//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 *  @dev Specification for contracts using time lock
 *
 *  Adapted from https://medium.com/cryptexfinance/how-to-create-time-locked-functions-523424def80
 *
 */
abstract contract TimeLock {
    enum Functions {
        UPDATE_PORTFOLIO,
        REBALANCE
    }
    uint256 public constant TIMELOCK = 2 days;
    mapping(Functions => uint256) public timelock;

    event TimeLockAnnouncement(
        Functions indexed _fn,
        uint256 indexed _due,
        string _message
    );

    modifier onlySupported(Functions _fn) {
        require(_fn == Functions.UPDATE_PORTFOLIO || _fn == Functions.REBALANCE, "TimeLock: function not supported");
        _;
    }

    modifier notLocked(Functions _fn) {
        require(timelock[_fn] != 0 && timelock[_fn] <= block.timestamp, "TimeLock: function is timelocked");
        _;
    }

    function lockUnlimited(Functions _fn) onlySupported(_fn) internal {
        timelock[_fn] = 0;
        emit TimeLockAnnouncement(_fn, 0, "Locked indefinitely");
    }

    function lock2days(Functions _fn, string calldata _message) internal onlySupported(_fn) {
        timelock[_fn] = block.timestamp + TIMELOCK;
        emit TimeLockAnnouncement(
            _fn,
            timelock[_fn],
            _message
        );
    }
}
