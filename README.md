# optimus

![Optimus Prime](http://fc06.deviantart.net/fs71/i/2013/257/4/9/optimus_prime_bust_by_makotoono-d6mc8vf.jpg)

## An autobot who adapts user repositories to work better with runnable.

Optimus is a RESTful transformer who helps our users by applying file system transformations to their repositories. He has two *prime* directives:

1. To test transformation and return debugging information (warnings, errors, and diffs)
2. To generate file transformation shell scripts (so they can be included in docker files)

*"Autobots, roll out!"*

### API Interface

Optimus exposes a single endpoint `PUT /` that requires the following query
parameters:

* `repo` - A git link to the repository upon which to perform the transformation
  rules. Ex: `git@github.com:CodeNow/api`.
* `commitish` - A git commitish to the specific commit in the repository upon
  which to run the transformation rules. Ex:
  `170bdd7672b75c4a51e394cf5217c97817321b32`.
* `deployKey` - The path to a valid deploy ssh private key for the repository
  that is stored in our S3 (this is the same path used by image builder).

Furthermore the body of the request must be a JSON formatted array containing
the transformation rules that are to be applied to the repository (see
[fs-transform's basic usage example](https://github.com/Runnable/fs-transform#basic-usage)
for an example of the rules array).

### Request Handling

Optimus must perform a large series of asynchronous tasks when handling an
individual request. To aid us in understanding everything that must be done,
let's walk through an example. Assume that optimus receives a request like so:

```
PUT /?repo=git@github.com:runnable/loadenv&commitish=29aeff...&deployKey=runnable/loadenv
[
  {"action": "replace", "search": "foo", "replace": "bar"},
  {"action": "rename", "source": "A.txt", "dest": "B.txt"}
]
```

This request is instructing optimus to perform two transformation rules: a
search and replace of "foo" with "bar", and a file rename of "A.txt" to "B.txt". It is to
perform the operations on the repository `loadenv` which is under the `runnable`
organization. Specifically the request states that the transforms should be run
on the commitish `29aeff...` with the deploy key path in S3 being
`runnable/loadenv`.

Given this description, optimus would perform the following tasks in sequence:

1. Check for cached copy of deploy key. If not in cache, fetch it from S3 and
   cache it on the local file system.
2. Check for a cached copy of the repository and specific commitish. If not in
   cache clone, fetch, checkout and cache repository on the local file system.
3. Use `fs-transform` to execute the rules given in the request body on the
   repository at the specific commitish.
4. Respond with results compiled by `fs-transform`.

### Architecture

Optimus uses process level clustering via
[cluster-man](https://github.com/runnable/cluster-man) to spin up `N` express
API servers which handle the single external route. Under the hood it uses
[fs-transform](https://github.com/runnable/fs-transform) to perform the actual
transformations.

From a design perspective, I chose a modular organization scheme that avoids OOP
(with one exception). There are 6 components that work in tandem, each with
their own domain of execution and flow control:

1. `lib/app` - Responsible for setting up and exposing the express application
   itself.
2. `lib/tranform` - Implements the `PUT /` route.
3. `lib/deploy-key` - Fetches the deploy keys from S3.
4. `lib/repository` - Fetches user repositories from github.
5. `lib/git` - Helper class for performing git commands for fetching, cloning,
   etc. (this is the one OOP exception to the modular design rule).
6. `lib/cache` - File system LRU cache implementation. This is a beast unto
   itself, see the "Caching Section" below.

For reference, here is a categorical dependency graph for the project's modules:

![optimus architecture](https://cloud.githubusercontent.com/assets/146592/7578572/8b146b6a-f80b-11e4-8728-52488afdf2e6.png)

### Caching

Optimus employs an implementation of LRU caching via the file system.
Specifically it stores cached copies of external resources and uses access time
(atime) to determine which files should be periodically purged.

There are three major caches used by the application, they are:

1. Caching of deploy keys fetched from S3
2. Caching of repository master branches (via git clone)
3. Caching of specific repository commitishes (via git fetch and checkout)

The `lib/cache` module provides an interface for interacting with these three
caches; specifically it allows initialization of the caches, purge locking /
unlocking, purging, usage statistics, and setting purge intervals.

### Spin Locking

Finally it is important to note the use of spin locking in `lib/repository`.
This is used to correctly handle multiple incoming requests to the same
repository. In this case, the repository fetch could take a long while and we
need to stop the flow for pending requests to the same repository until it has
been fetched and cached.

**Important:** Spin locking is currently implemented as an process-memory map of
paths on the file system to booleans. This will not work for clustering. For now
we just need to get this out the door with a single process in the cluster and
will be tackling the distributed locks soon (see #3).
