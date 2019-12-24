# Changelog

All notable changes to this project will be documented in this file.

## [0.6.0] - 2019-12-24

### Changed

-   Add colors for rooms from jira statuses.

## [0.3.0] - 2019-02-14

### Changed

-   Start possibility for other messengers.
-   New config validation
-   Critic change, use config-example for more information

## [0.2.2] - 2018-11-26

### Changed

-   Add check for status 404 in create room and handle events. If it's true we don't keep it and consider it to be correct.
    It's made for ignoring private jira tasks.

## [0.2.1] - 2018-11-13

### Added

-   File `CHANGELOG.md`

### Changed

-   Using optionally `inviteIgnoreUsers` in config.
