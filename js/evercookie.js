/** @example
 *
    var ec = new EverCookie();

    // set a cookie "id" to "12345"
    // usage: ec.set(key, value)
    ec.set("id", "12345");

    // retrieve a cookie called "id" (simply)
    ec.get("id", function(value) { alert("Cookie value is " + value) });

    // or use a more advanced callback function for getting our cookie
    // the cookie value is the first param
    // an object containing the different storage methods
    // and returned cookie values is the second parameter
    function getCookie(best_candidate, all_candidates)
    {
      alert("The retrieved cookie is: " + best_candidate + "\n" +
        "You can see what each storage mechanism returned " +
        "by looping through the all_candidates object.");

      for (var item in all_candidates)
        document.write("Storage mechanism " + item +
          " returned " + all_candidates[item] + " votes<br>");
      }
      ec.get("id", getCookie);

    // we look for "candidates" based off the number of "cookies" that
    // come back matching since it's possible for mismatching cookies.
    // the best candidate is very-very-likely the correct one

 *
 **/

(function (window) {
    window.EverCookie = function (options) {
        'use strict';

        ////// private variables //////

        // Define effective options.
        var options = options || {};

        // Define default options.
        var default_options = {
            domain       : null,

            wait_max     : 1000,
            poll_interval: 30  ,

            // List of mechanisms to make active. Overrides defaults.
            enable       : [
                //'cookie'       ,
                //'db_store'     ,
                //'etag'         ,
                //'flash'        ,
                //'global_store' ,
                //'history'      ,
                //'java'         ,
                //'local_store'  ,
                //'png'          ,
                //'session_store',
                //'silverlight'  ,
                //'user_data'    ,
                //'web_cache'    ,
                //'window_name'
              ],

            // List of mechanisms to disable. Overrides defaults and takes precedence over enable list.
            disable      : [
                //'flash'        ,
                //'history'      ,
                //'java'         ,
                //'silverlight'
              ]
        };

        // Track delayed functions/timers.
        var state = {
            get_timers: {},
            set_timers: {},
            async_gets: [], //TODO
            async_sets: []  //TODO
        };

        // Define available storage mechanisms and if active by default.
        var storage = {
            cookie       : { active: true , realtime: true  , fn_get: get__cookie       , fn_set: set__cookie       },
            db_store     : { active: true , realtime: true  , fn_get: get__db_store     , fn_set: set__db_store     },
            etag         : { active: true , realtime: false , fn_get: get__etag         , fn_set: set__etag         },
            flash        : { active: false, realtime: false , fn_get: get__flash        , fn_set: set__flash        },
            global_store : { active: true , realtime: true  , fn_get: get__global_store , fn_set: set__global_store },
            history      : { active: false, realtime: false , fn_get: get__history      , fn_set: set__history      },
            java         : { active: false, realtime: false , fn_get: get__java         , fn_set: set__java         },
            local_store  : { active: true , realtime: true  , fn_get: get__local_store  , fn_set: set__local_store  },
            png          : { active: true , realtime: false , fn_get: get__png          , fn_set: set__png          },
            session_store: { active: true , realtime: true  , fn_get: get__session_store, fn_set: set__session_store},
            silverlight  : { active: false, realtime: false , fn_get: get__silverlight  , fn_set: set__silverlight  },
            user_data    : { active: true , realtime: true  , fn_get: get__user_data    , fn_set: set__user_data    },
            web_cache    : { active: true , realtime: true  , fn_get: get__web_cache    , fn_set: set__web_cache    },
            window_name  : { active: true , realtime: true  , fn_get: get__window_name  , fn_set: set__window_name  }
        };


        //// "constructor" ////
        (function () {
            // Set more default options.
            {
                var host = window.location.host,
                    domain = host.replace(/:\d+$/, '');
                if (!domain.match(/^[0-9]+\.[0-9]\.[0-9]+\.[0-9]+$/)) {
                    domain = '.' + domain;
                }
                default_options['domain'] = domain;
            }
            // Make a pass at merging option settings.
            for (var key in default_options) {
                options[key] = options[key] || default_options[key];
            }

            // Enable mechanisms.
            for (var k in options['enable']) {
                var key = options['enable'][k];
                storage[key] && (storage[key].active = true);
            }

            // Disable mechanisms.
            for (var k in options['disable']) {
                var key = options['disable'][k];
                storage[key] && (storage[key].active = false);
            }
            // Extend Object with size function.
            Object.size = function(obj) {
                var size = 0;

                if (typeof Object.keys == 'function') {
                    size = Object.keys(obj).length;
                }
                else {
                    for (var key in obj) {
                        if (obj.hasOwnProperty(key)) size++;
                    }
                }

                return size;
            };
        })();

        ////// public methods //////

        /*
         * Get a cookie's value.
         * @param {string} key
         * @param {function=} callback
         * @param {boolean=} realtime_only
         * @returns {string}
         */
        this.get = function (key, callback, realtime_only) {
            log.debug("get '" + key + "'");

            // Collect value from each mechanism into values array.
            var values = [];

            // Iterate storage mechanisms.
            for (var k in storage) {

                // Skip disabled mechanisms.
                if (!storage[k].active) {
                    continue;
                }
                // Clear old timers.
                if (state.get_timers[k]) {
                    clearTimeout(state.get_timers[k]);
                    delete state.get_timers[k];
                    }

                // Call real-time get methods.
                if (storage[k].realtime == true) {
                    try {
                        log.debug('get:' + k);

                        var value = storage[k].fn_get(key);
                        if (typeof value == 'string') {
                            values.push(value);
                        }
                        log.debug('get:' + k + '=' + value);
                    } catch (e) {
                        log.error('get:' + k + ' ' + e.message);
                    }
                }

                // Call delayed get methods.
                else if (!realtime_only) {
                    state.get_timers[k] =
                      setTimeout(
                        function() {
                            try {
                                delete state.get_timers[k];
                                log.debug('get:' + k);
                                storage[k].fn_get(key);
                            } catch (e) {
                                log.error('get:' + k + ' ' + e.message);
                            }
                        },
                        1
                      );
                }
            }

            if (realtime_only) {
                var value = tally(values);
                log.debug("get real-time '" + key + "' = " + (typeof value == 'string' ? "'" + value + "'" : value));
                return value;
            }
            else {
                //TODO start poll timer
            }
        };

        /*
         * Set a cookie's value.
         * @param {string} key
         * @param {string} value
         * @param {function=} callback
         * @param {boolean=} realtime_only
         */
        this.set = function (key, value, callback, realtime_only) {
            log.debug("set '" + key + "' = '" + value + "'");

            // Iterate storage mechanisms.
            for (var k in storage) {

                // Skip disabled mechanisms.
                if (!storage[k].active) {
                    continue;
                }

                // Clear old timers.
                if (state.set_timers[k]) {
                    clearTimeout(state.set_timers[k]);
                    delete state.set_timers[k];
                }

                // Call real-time set methods.
                if (storage[k].realtime == true) {
                    try {
                        log.debug('set:' + k);
                        storage[k].fn_set(key, value);
                    } catch (e) {
                        log.error('set:' + k + ' ' + e.message);
                    }
                }

                // Call delayed set methods.
                else if (!realtime_only) {
                    state.set_timers[k] =
                      setTimeout(
                        function() {
                            try {
                                delete state.set_timers[k];
                                log.debug('set:' + k);
                                storage[k].fn_set(key, value);
                            } catch (e) {
                                log.error('set:' + k + ' ' + e.message);
                            }
                        },
                        1
                      );
                }
            }
        };

        ////// private methods //////

        var tally = function (values) {
            var counts = {},
                leader = null,
                max = 0;

            for (var k in values) {
                var val = values[k],
                    idx = ':' + val,
                    count = (counts[idx] || 0) + 1;
                
                if (count > max) {
                    leader = val;
                    max = count;
                }

                counts[idx] = count;
            }

            return leader;
        };

        var log = (function(){
            function log(type, msg) {
                if (!console || !console.log) return;
                msg = '[EC:' + type + '] ' + msg;
                console[type] ? console[type](msg) : console.log(msg);
            }
            function debug(msg) { log('debug', msg); }
            function info (msg) { log('info' , msg); }
            function warn (msg) { log('warn' , msg); }
            function error(msg) { log('error', msg); }
            return { debug: debug, info: info, warn: warn, error: error };
        })();

        //// helper methods ////

        /**
         * @param {string} key
         * @param {string} str
         * @returns {string|null}
         */
        var str_param_get = function (str, key) {
            if (typeof str != 'string') {
                return null;
            }

            var re = new RegExp("(^|&|; *)" + encodeURI(key) + "=(.*?)($|&|; *)");
            var match = re.exec(str);
            return match && (match[2] !== undefined) ? decodeURI(match[2]) : null;
        };

        /**
         * @param {string} str
         * @param {string} key
         * @param {string} value
         * @returns {string}
         */
        var str_param_set = function (str, key, value) {
            var pair = encodeURI(key) + '=' + encodeURI(value);

            // If pair doesn't exist in str.
            if (str_param_get(str, key) === null) {
                return (str != "" ? '&' : '') + pair;
            }

            // Replace existing pair in str.
            var re = new RegExp("(^|&|; *)" + encodeURI(key) + "=(.*?)($|&|; *)");
            var match = re.exec(str);
            return str.replace(re, match[1] + pair + match[3]);
        };

        //// storage_mechanism get & set methods ////

        function get__cookie (key) {
            return str_param_get(document.cookie, key);
        }

        function set__cookie (key, value) {
            // Expire any existing cookie.
            document.cookie = encodeURI(key) + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + options.domain;

            // Set new cookie.
            document.cookie = encodeURI(key) + "=" + encodeURI(value) + "; expires=Tue, 31 Dec 2030 00:00:00 UTC; path=/; domain=" + options.domain;
        }

        function get__db_store (key) {

        }

        function set__db_store (key, value) {

        }

        function get__etag (key) {

        }

        function set__etag (key, value) {

        }

        function get__flash (key) {

        }

        function set__flash (key, value) {

        }

        function get__global_store (key) {

        }

        function set__global_store (key, value) {

        }

        function get__history (key) {

        }

        function set__history (key, value) {

        }

        function get__java (key) {

        }

        function set__java (key, value) {

        }

        function get__local_store (key) {

        }

        function set__local_store (key, value) {

        }

        function get__png (key) {

        }

        function set__png (key, value) {

        }

        function get__session_store (key) {

        }

        function set__session_store (key, value) {

        }

        function get__silverlight (key) {

        }

        function set__silverlight (key, value) {

        }

        function get__user_data (key) {

        }

        function set__user_data (key, value) {

        }

        function get__web_cache (key) {

        }

        function set__web_cache (key, value) {

        }

        function get__window_name (key) {
            return str_param_get(window.name, key);
        }

        function set__window_name (key, value) {
            window.name = str_param_set(window.name, key, value);
        }
    };
})(window);
