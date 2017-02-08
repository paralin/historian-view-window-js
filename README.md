Historian View Window
=====================

[![Greenkeeper badge](https://badges.greenkeeper.io/FuseRobotics/historian-view-window-js.svg?token=6b300921a7cde62f426fe74611afe4af2ef19ec43bb8e113d6b97d5e97aa6dd0)](https://greenkeeper.io/)

Consumes `grpc-bus` and `state-stream` and `remote-state-stream` and `reporter` to consume a remote state stream as a window implementation.

Multiplexer Usage
=================

The idea of the multiplexer is to allow an app to provide a changing set of remote view service handles over time. This is intended for the real-world case of connecting to the cloud historian, vs connecting directly to a device.

First, a multiplexer is instantiated. This will immediately produce a WindowFactory which is backed by a remote-state-stream window multiplexer. Without any service handles, these windows will remain in the pending state forever. With only failing service handles, these windows will always fail. With at least one working service handle, these windows will succeed.

Adding or removing state stream will add or remove underlying remote view windows.

Features
========

 - [x] remote view window
 - [x] remote view connection multiplexer

