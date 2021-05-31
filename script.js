var stations;
var players = {};
var multiPlay = false;
var startFrags = [];
var readyCount = 0;

/**
 * Populates the page.
 */
function onLoad() {
    $.getJSON("stations.json", function(result) {
        stations = result;

        // Remove the loading message
        $("#temp").remove();

        // Loop through each category
        $.each(stations, function(categoryName,categoryContent) {
            // Add each category to the page
            $('#main-container').append("<div id='" + categoryName + "' class='category'></div>");
            $('#' + categoryName).append("<div class='category-title'>" + categoryContent["title"] + "</div>");
            $('#' + categoryName).append("<div class='category-stations'></div>");

            if(categoryContent["local"] == true) {
                $('#' + categoryName).addClass("category-filter-local");
            }
            if(categoryContent["bbcws"] == true) {
                $('#' + categoryName).addClass("category-filter-bbcws");
            }
            if(categoryContent["bbcnations"] == true) {
                $('#' + categoryName).addClass("category-filter-bbcnats");
            }

            // Loop through each station in each category
            $.each(categoryContent["stations"], function(stationName, stationContent) {
                // Add each station to the page
                $('#' + categoryName + '>.category-stations').append("<div id='" + stationName + "' class='station'>" + stationContent["title"].replace("(","<br />(") + "</div>");
                // Add pan controls and associated event listeners
                $('#' + categoryName + '>.category-stations>#' + stationName).append("<div class='station-pan-controls hidden'><div class='station-pan-l'>L</div><div class='station-pan-r'>R</div></div>");
                $('#' + categoryName + '>.category-stations>#' + stationName + '>.station-pan-controls>.station-pan-l').click(function(event) {
                    event.stopPropagation();
                    if(players[stationName].panR) {
                        players[stationName].pan(true, false);
                        $(this).toggleClass('pan-off');
                    }
                });
                $('#' + categoryName + '>.category-stations>#' + stationName + '>.station-pan-controls>.station-pan-r').click(function(event) {
                    event.stopPropagation();
                    if(players[stationName].panL) {
                        players[stationName].pan(false, true);
                        $(this).toggleClass('pan-off');
                    }
                });
                // Add an empty audio element to the station box.
                // We'll populate it later on if neded.
                $('#' + categoryName + '>.category-stations>#' + stationName).append("<audio></audio>");
                // Create a player for each station and add it to the players dict
                players[stationName] = new RadioPlayer(stationName);

                // If the station is clicked on, start it playing.
                $('#' + categoryName + '>.category-stations>#' + stationName).click(function(d) {
                    players[($(d["target"]).attr('id'))].playStop();
                });
            });
        });
    });

    // Set event handlers for the buttons on the top-right
    $('#btn-filter-local').on('click', function() {
        $('.category-filter-local').toggleClass('hidden');
        $(this).toggleClass('btn-on');
    });
    $('#btn-filter-bbcnats').on('click', function() {
        $('.category-filter-bbcnats').toggleClass('hidden');
        $(this).toggleClass('btn-on');
    });
    $('#btn-filter-bbcws').on('click', function() {
        $('.category-filter-bbcws').toggleClass('hidden');
        $(this).toggleClass('btn-on');
    });

    $('#btn-sync').on('click', function() {
        syncUp(true);
        $(this).toggleClass('btn-on');
        setTimeout(function() {
            $("#btn-sync").toggleClass('btn-on')
        }, 100);
    });
    $('#btn-multi').on('click', function() {
        $(this).toggleClass('btn-on');
        multiPlay = !multiPlay;
    });
    $('#btn-stopall').on('click', function() {
        stopAll();
        $(this).toggleClass('btn-on');
        setTimeout(function() {
            $("#btn-stopall").toggleClass('btn-on')
        }, 100);
    });
}

/**
 * Stops all stations that are currently playing.
 */
function stopAll() {
    for(player in players) {
        players[player].stop();
    }
}

/**
 * Attempts to synchronise playing stations.
 */
function syncUp() {
    readyCount = 0;
    startFrags = [];
    for(player in players) {
        thisPlayer = players[player];
        if(!thisPlayer.audioElement.paused) {
            thisPlayer.stop();
            thisPlayer.loadPlay(true);
        }
    }
}

/**
 * Plays a radio station.
 */
class RadioPlayer {
    /**
     * Populate our variables for later use
     * @param stationName {string} The name of the station as found in the stations dictionary.
     */
    constructor(stationName){
        this.listeners = [];
        this.hls = false;
        this.stationName = stationName;
        this.categoryName = $("#" + this.stationName).parent().parent().attr("id");
        this.stationDict = stations[this.categoryName]["stations"][stationName];
        this.stationFullName = this.stationDict["title"];
        if(this.stationDict["hls"]) {
            this.hls = true;
        }
        this.url = this.stationDict["url"];
        this.audioElement = $("#" + this.stationName + ">audio")[0];
        this.panControls = $("#" + this.stationName + ">.station-pan-controls")[0];
        this.panL = true;
        this.panR = true;
    }

    /**
     * Preps the station for playing, and then starts it playing.
     * @param sync {boolean} Optional - set true if trying to sync stations using HLS
     */
    loadPlay(sync=false) {
        var audioElement = this.audioElement;
        var panControls = this.panControls;

        // If 'play multiple' is off, stop all other stations
        // before proceeding...
        if(!multiPlay) {
            stopAll();
        }

        // Create event handlers to colour code the station button showing
        // playing status
        $(this.audioElement).on('loadstart',function() {
            $(audioElement).parent().removeClass('station-loading station-playing');
            $(audioElement).parent().addClass('station-loading');
            $(panControls).removeClass('hidden');
        });
        $(this.audioElement).on('pause', function() {
            $(audioElement).parent().removeClass('station-loading station-playing');
            $(panControls).addClass('hidden');
        });
        $(this.audioElement).on('play playing', function() {
           $(audioElement).parent().removeClass('station-loading station-playing');
           $(audioElement).parent().addClass('station-playing');
        });

        // If this station and the client supports hls.js...
        if (this.hls && Hls.isSupported()) {
            // Create a new hls.js object
            this.hlsObj = new Hls();
            this.hlsObj.loadSource(this.url);
            this.hlsObj.attachMedia(this.audioElement);

            // Once the first fragment is loaded, push its number to
            // the startFrags array for sync purposes.
            this.hlsObj.once(Hls.Events.FRAG_LOADED, function (d1, d2) {
                startFrags.push(d2["frag"]["sn"]);
                // If we are trying to sync stations...
                if (sync) {
                    // Check if all stations are on the same start frag...
                    if (!allEqual(startFrags)) {
                        // ... if not, call the reload function to try again.
                        syncUp();
                    }
                }
            });

            // Once we're ready to play...
            this.hlsObj.once(Hls.Events.MANIFEST_PARSED, function () {
                // Increment the ready counter for sync purposes
                readyCount++;
                // If we're trying to sync stations...
                if (sync) {
                    // If we're the last station to be ready...
                    if (readyCount == $(".station-loading").length) {
                        // ... set all waiting stations playing.
                        setTimeout(function () {
                            $.each($(".station-loading>audio"), function (i, thisAudioElement) {
                                thisAudioElement.play();
                            });
                        }, 1000);
                    }
                    // If we're not trying to sync, just start playing.
                } else {
                    audioElement.play();
                }
            });
        // If the station doesn't use HLS or if hls.js isn't supported...
        } else {
            this.audioElement.setAttribute('src',this.url);
            this.audioElement.play();
        }

        if(!this.audioCtx) {
            this.audioElement.crossOrigin = "anonymous";
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.audioCtxSource = this.audioCtx.createMediaElementSource(this.audioElement);
            this.panNode = this.audioCtx.createStereoPanner();
            this.audioCtxSource.connect(this.panNode).connect(this.audioCtx.destination);
        }
    }

    /**
     * Sets pan controls for the station
     * @param toggleL toggle left channel on/off
     * @param toggleR toggle right channel on/off
     */
    pan(toggleL,toggleR) {
        if(toggleL) {
            this.panL = !this.panL;
        }
        if(toggleR) {
            this.panR = !this.panR;
        }
        var leftValue = 0;
        var rightValue = 0;
        if(this.panL) {
            leftValue = -1;
        }
        if(this.panR) {
            rightValue = 1;
        }
        console.log(leftValue+rightValue)
        this.panNode.pan.setValueAtTime(leftValue+rightValue,this.audioCtx.currentTime);
    }

    /**
     * Stops the station from playing
     */
    stop() {
        if(!this.audioElement.paused) {
            this.audioElement.pause();
            this.audioElement.setAttribute('src', '');
            $(this.audioElement).off("loadstart play playing pause");
            $(this.audioElement).parent().removeClass('station-loading station-playing');
            $(this.panControls).addClass('hidden');
            if (this.hls) {
                this.hlsObj.destroy();
            }
        }
    }

    /**
     * Toggles the station between playing and stopped.
     */
    playStop(){
        if(this.audioElement.paused) {
            this.loadPlay();
        }
        else {
            this.stop();
        }
    }
}

/**
 * Checks if all elements in an array are the same
 * @param arr {array} The array to check
 * @returns {*}
 */
const allEqual = arr => arr.every( v => v === arr[0] )