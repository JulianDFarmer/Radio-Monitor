var stations;
var players = {};
var multiPlay = false;
var startFrags = [];
var readyCount = 0;
var webAudio = true;
var iOS = false;

/**
 * Populates the page.
 */
function onLoad() {

    webAudio = webAudioSupported();
    iOS = isiOS();

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

            // Add classes to allow filtering
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
                    updateParams();
                });
                $('#' + categoryName + '>.category-stations>#' + stationName + '>.station-pan-controls>.station-pan-r').click(function(event) {
                    event.stopPropagation();
                    if(players[stationName].panL) {
                        players[stationName].pan(false, true);
                        $(this).toggleClass('pan-off');
                    }
                    updateParams();
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
        getParams();
    });

    // Set event handlers for the buttons on the top-right
    $('#btn-filter-local').on('click', function() {
        $('.category-filter-local').toggleClass('hidden');
        $(this).toggleClass('btn-on');
        updateParams();
    });
    $('#btn-filter-bbcnats').on('click', function() {
        $('.category-filter-bbcnats').toggleClass('hidden');
        $(this).toggleClass('btn-on');
        updateParams();
    });
    $('#btn-filter-bbcws').on('click', function() {
        $('.category-filter-bbcws').toggleClass('hidden');
        $(this).toggleClass('btn-on');
        updateParams();
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
        updateParams();
    });
    $('#btn-stopall').on('click', function() {
        stopAll();
        updateParams();
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
    console.log(players.length);
    $.each(players, function(index,player) {
        if(player.hlsObj) {
            player.stop();
            player.loadPlay(true);
        }
    });
}

function syncReady() {
    readyCount++;

    // If all stations are ready...
    if (readyCount == $(".station-loading").length) {
        // Check if all stations are on the same start frag...
        console.log(allEqual(startFrags));
        console.log(startFrags.length);
        if (!allEqual(startFrags)) {
            // ... if not, call the reload function to try again.
            setTimeout(function() {
                syncUp();
            },500);
        } else {
            // ... if they are, set all waiting stations playing.
            setTimeout(function () {
                $.each($(".station-loading>audio"), function (i, thisAudioElement) {
                    thisAudioElement.play();
                });
            }, 100);
        }
    }
}

/**
 * Retrieves URL parameters and applies the settings to the page.
 * If there are stations to start playing, we need user interaction
 * before we can start audio. In this case, this function will put
 * up an overlay for the user to click on, and then return without applying
 * any settings at all.
 *
 * When the user clicks on the overlay, this function is called again but
 * with applyStations set to true - in this case, it will apply all settings
 * now that we've had user interaction.
 * @param applyStations Should we apply settings if there are stations to play?
 */
function getParams(applyStations = false) {
    // Grab the raw parameters from the URL and split them into an array
    var params = decodeURIComponent(location.search).split("?")[1].split("&");
    // Loop through each parameter
   for (param in params) {
        // Separate the key from the value
        var thisParam = params[param].split("=");
        var variable = thisParam[0].toLowerCase();
        var value = thisParam[1].toLowerCase();

        // If the user has passed any stations to play...
        if (variable == "stations") {
            // Check if they've passed true - ie check if
            // there's been any user interaction
            if(applyStations) {
                // Hide the overlay
                $("#overlay").addClass("hidden");
                var stationsList = value.toLowerCase().split(',');
                var i = 0;
                // Go through each entry given...
                for (station in stationsList) {
                    var thisStation = stationsList[station].trim();
                    // If this entry is a pan instruction, apply the
                    // panning to the previous entry (ie a station)
                    if (thisStation == "l" && i > 0) {
                        $("#" + stationsList[i - 1] + ">.station-pan-controls>.station-pan-r").click();
                    } else if (thisStation == "r" && i > 0) {
                        $("#" + stationsList[i - 1] + ">.station-pan-controls>.station-pan-l").click();
                    // Otherwise, assume this entry is a station
                    } else {
                        $("#" + thisStation).click();
                    }
                    i++;
                }
                // Synchronise all loaded stations
                syncUp();
            // If we've been given stations to play but we've not
            // yet had user interaction...
            } else {
                // Display the overlay and set an event handler for
                // the user clicking on it.
                $("#overlay").removeClass("hidden");
                $("#overlay").one("click", function() {
                    // Call this function again but pass true to load
                    // the stations now we've had user interaction
                    getParams(true);
                });
                return;
            }
        }
        // Handle settings that have been passed by the user
        else if (variable == "filterlocal") {
            if(value=="true") {
                $("#btn-filter-local").click();
            }
        }
        else if (variable == "filternations") {
            if(value=="true") {
                $("#btn-filter-bbcnats").click();
            }
        }
        else if (variable == "filterws") {
            if(value=="true") {
                $("#btn-filter-bbcws").click();
            }
        }
        else if (variable == "playmulti") {
            if(value=="true") {
                $("#btn-multi").click();
            }
        }
    }
}

/**
 * Updates the URL parameters based on settings / stations being
 * listened to. This should be called every time something is changed
 * and allows a user to share or bookmark the URL to recall the current
 * state of the page.
 */
function updateParams() {
    var playMulti = multiPlay;
    var filterWS = !$("#btn-filter-bbcws").hasClass("btn-on");
    var filterNations = !$("#btn-filter-bbcnats").hasClass("btn-on");
    var filterLocal = !$("#btn-filter-local").hasClass("btn-on");
    var stations = [];

    $(".station-playing").each(function() {
        var panL = !$(this).children(".station-pan-controls").children(".station-pan-l").hasClass("pan-off");
        var panR = !$(this).children(".station-pan-controls").children(".station-pan-r").hasClass("pan-off");
        stations.push($(this).attr("id"));
        if(panL && !panR) {
            stations.push('l');
        }
        else if(!panL && panR) {
            stations.push('r');
        }
    });

    var paramString = "?"
    if(stations.length) {
        paramString += "stations=" + stations.join(",") + "&";
    }
    if(filterWS) {
        paramString += "filterWS=true&";
    }
    if(filterNations) {
        paramString += "filterNations=true&";
    }
    if(filterLocal) {
        paramString += "filterLocal=true&";
    }
    if(playMulti) {
        paramString += "playmulti=true&";
    }

    if(paramString.slice(-1)=="&") {
        paramString = paramString.slice(0,-1);
    }

    history.pushState({},null,paramString);
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
            if(webAudio || !iOS) {
                $(panControls).removeClass('hidden');
            }
            updateParams();
        });
        $(this.audioElement).on('pause', function() {
            $(audioElement).parent().removeClass('station-loading station-playing');
            if(webAudio || !iOS) {
                $(panControls).addClass('hidden');
            }
            updateParams();
        });
        $(this.audioElement).on('play playing', function() {
           $(audioElement).parent().removeClass('station-loading station-playing');
           $(audioElement).parent().addClass('station-playing');
           updateParams();
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
                // If we're trying to sync stations...
                if(sync) {
                    // Call syncReady() to show this station is ready
                    //syncReady();
                    syncReady();
                } else {
                    // If we're not trying to sync, just start playing.
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
                delete this.hlsObj;
            }
            updateParams();
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
function allEqual(arr) {
    return arr.every(function(n) {
       return n == arr[0];
    });
}

function webAudioSupported() {
    try {
        context = new AudioContext();
    } catch {
      return false;
    }
    return true;
}

function isiOS() {
    return !!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform);
}