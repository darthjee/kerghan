<?php

// Standalone stack values (committed: no secrets here).
// The backend is the inner compose `kerghan` service, listening on PORT=3000.
$backendHost = 'http://kerghan:3000/';
// Tent's document root; the built frontend is mounted at $staticRoot . '/static'.
$staticRoot = '/var/www/html';
$cacheFolder = './cache';
