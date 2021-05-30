var stations;
var hlsElements = {};
var playingElements = {};
var playOne = true;
var startFrags = [];
var readyCount = 0;

function killAll() {
	for (i in playingElements) {
		var ele = $(playingElements[i]).parent();
		ele.click();
	}	
}

function onLoad() {
  $.getJSON("stations.json", function(result) {
    stations = result;
    $('body').empty();
	$('body').append("<div id='header'></div>");
	$('#header').append("<div id='page-header-title'>Radio Monitor</div>");
	$('#header').append("<div id='page-header-buttons'></div>");
	$('#page-header-buttons').append("<div id='sync-button' class='header-button'>Sync Playing</div>");
	$('#page-header-buttons').append("<div id='kill-button' class='header-button'>Kill All</div>");	
	$('#page-header-buttons').append("<div id='playone-button' class='header-button'>Play Multiple</div>");	
	$('#page-header-buttons').append("<div id='filter-bbcws-button' class='header-button button-on'>BBC <br />WS</div>");
	$('#page-header-buttons').append("<div id='filter-bbcnats-button' class='header-button button-on'>BBC Nations</div>");
	$('#page-header-buttons').append("<div id='filter-local-button' class='header-button button-on'>Local Stations</div>");

	$('body').append("<div id='container'></div>");
	$('#sync-button').on('click', function() {
		reload(true);
		$('#sync-button').toggleClass('button-on');
		setTimeout(function() {
			$('#sync-button').toggleClass('button-on')
		}, 100);
	});
	$('#playone-button').on('click', function() {
		$('#playone-button').toggleClass('button-on');
		playOne = !playOne;
	});
	$('#kill-button').on('click', function() {
		killAll();
		$('#kill-button').toggleClass('button-on');
		setTimeout(function() {
			$('#kill-button').toggleClass('button-on')
		}, 100);
	});
	$('#filter-local-button').on('click', function() {
		$('.filter-local').toggleClass('hidden');
		$('#filter-local-button').toggleClass('button-on');
	});
	$('#filter-bbcnats-button').on('click', function() {
		$('.filter-bbcnats').toggleClass('hidden');
		$('#filter-bbcnats-button').toggleClass('button-on');
	});
	$('#filter-bbcws-button').on('click', function() {
		$('.filter-bbcws').toggleClass('hidden');
		$('#filter-bbcws-button').toggleClass('button-on');
	});
    $.each(stations, function(catname,catcont) {
      $('#container').append("<div id='" + catname + "' class='category'></div>");
      $('#' + catname).append("<div class='title'>" + catcont["title"] + "</div>");
      $('#' + catname).append("<div class='stations'></div>");
	  if(catcont["local"]) {
		$('#' + catname).addClass("filter-local");
	  }
	  if(catcont["bbcws"]) {
		$('#' + catname).addClass("filter-bbcws");
	  }
	  if(catcont["bbcnations"]) {
		$('#' + catname).addClass("filter-bbcnats");
	  }	  
      $.each(catcont["stations"], function(statname, statcont) {
        $('#' + catname + '>.stations').append("<div id='" + statname + "' class='station'>" + statcont["title"].replace("(","<br />(") + "</div>");
        $('#' + catname + '>.stations>#' + statname).append("<audio></audio>");
        var audio = $('#' + catname + '>.stations>#' + statname + '>audio')[0];
		$(audio).on('loadstart',function() {
			if(audio.src != "about:blank") {
				$(audio).parent().removeClass('loading playing');
				$(audio).parent().addClass('loading');
			}
		});
		$(audio).on('play playing',function() {
			$(audio).parent().removeClass('loading playing');
			$(audio).parent().addClass('playing');
		});
		$(audio).on('pause',function() {
			$(audio).parent().removeClass('loading playing');
		});
        $('#' + catname + '>.stations>#' + statname).click(function(d) {
		  play($(d["target"]).attr('id'));
        });
      });
    });
  });
}

function play(statname,sync=false) {
  var catname = $("#" + statname).parent().parent().attr("id");
  var audio = $("#" + statname + ">audio")[0];
  if(playingElements[statname]) {
	if(stations[catname]["stations"][statname]["hls"] && Hls.isSupported()) {
	  audio.pause();
	  hlsElements[statname].destroy();
	  delete hlsElements[statname];
	  readyCount = 0;
	} else {
	  audio.pause();
	  audio.setAttribute('src','about:blank');
	}
	delete playingElements[statname];	
	$(audio).parent().removeClass('loading playing');			
  } else {
	  if(playOne) {
		killAll();
	  }			  
	  if(stations[catname]["stations"][statname]["hls"] && Hls.isSupported()) {
	  var hls = new Hls();
	  hls.loadSource(stations[catname]["stations"][statname]["url"]);
	  hls.attachMedia(audio);
	  hls.once(Hls.Events.FRAG_LOADED, function(d1,d2) {
		startFrags.push(d2["frag"]["sn"]);
	    if(sync) {
		  if(!allEqual(startFrags)) {
	       reload(true);
		   return;
		  }
	    }
	  });
	  hls.on(Hls.Events.MANIFEST_PARSED, function() {
	    readyCount++;
		if(sync) {
		  if(readyCount==$(".loading").length) {
			console.log(1);
			setTimeout(function() {
			  $.each($(".loading>audio"), function(i,thisAudio) {
			    thisAudio.play();
			  });
			},1000);
		  }
		} else{
 		  audio.play();
		}
	  });
	  hlsElements[statname] = hls;
	} else {
	  audio.setAttribute('src',stations[catname]["stations"][statname]["url"]);
	  audio.play();
	}
	playingElements[statname] = audio;
  }
}

function reload(sync=false) {
  if(sync) {
    startFrags = [];
  }
  $.each(playingElements, function(statname, audio) {
	play(statname,sync);
    setTimeout(function(){play(statname,sync);},1000);
  });
}

const allEqual = arr => arr.every( v => v === arr[0] )
