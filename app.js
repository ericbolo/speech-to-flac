var recorderApp = angular.module('recorder', [ ]);

recorderApp.controller('RecorderController', [ '$scope' , function($scope) {
	$scope.audio_context = null;
	$scope.stream = null;
	$scope.recording = false;
	$scope.encoder = null;
	$scope.ws = null;
	$scope.input = null;
	$scope.node = null;
	$scope.samplerate = 44100;
	$scope.samplerates = [ 8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000 ];
	$scope.compression = 5;
	$scope.compressions = [ 0, 1,2,3,4,5,6,7,8 ];
	// $scope.bitrate = 16;
	// $scope.bitrates = [ 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 192, 224, 256, 320 ];
	$scope.recordButtonStyle = "red-btn";
    $scope.flacdata = {};
    $scope.flacdata.bps = 16;
    $scope.flacdata.channels = 1;
    $scope.flacdata.compression = 5;
      
	$scope.startRecording = function(e) {
		if ($scope.recording)
			return;
		
		console.log('start recording');//DEBUG
		
		$scope.encoder = new Worker('encoder.js');

        
		console.log('initializing encoder with:');//DEBUG
        console.log(' bits-per-sample = ' + $scope.flacdata.bps);//DEBUG
        console.log(' channels        = ' + $scope.flacdata.channels);//DEBUG
        console.log(' sample rate     = ' + $scope.samplerate);//DEBUG
        console.log(' compression     = ' + $scope.compression);//DEBUG
        
		$scope.encoder.postMessage({ cmd: 'init', config: { samplerate: $scope.samplerate, bps: $scope.flacdata.bps, channels: $scope.flacdata.channels, compression:$scope.compression  } });

		$scope.encoder.onmessage = function(e) {
			
			if (e.data.cmd == 'end') {

				console.log("Received END message");
				$scope.encoder.terminate();
				$scope.encoder = null;
				
			}
            else if(e.data.cmd == 'chunk'){
                console.log("got chunk")
                console.log(e.data)
            }
            else if (e.data.cmd == 'debug') {
				
                console.log(e.data);
                
            } else {
            	
				console.error('Unknown event from encoder (WebWorker): "'+e.data.cmd+'"!');
            }
		};

		if(navigator.webkitGetUserMedia)
			navigator.webkitGetUserMedia({ video: false, audio: true }, $scope.gotUserMedia, $scope.userMediaFailed);
		else if(navigator.mozGetUserMedia)
			navigator.mozGetUserMedia({ video: false, audio: true }, $scope.gotUserMedia, $scope.userMediaFailed);
		else
			navigator.getUserMedia({ video: false, audio: true }, $scope.gotUserMedia, $scope.userMediaFailed);
				
	};

	$scope.userMediaFailed = function(code) {
		console.log('grabbing microphone failed: ' + code);
	};

	$scope.gotUserMedia = function(localMediaStream) {
		$scope.recording = true;
		$scope.recordButtonStyle = '';

		console.log('success grabbing microphone');
		$scope.stream = localMediaStream;

		var audio_context;
		if(typeof webkitAudioContext !== 'undefined'){
			audio_context = new webkitAudioContext;
		}else if(typeof AudioContext !== 'undefined'){
			audio_context = new AudioContext;
		}
		else {
			console.error('JavaScript execution environment (Browser) does not support AudioContext interface.');
			alert('Could not start recording audio:\n Web Audio is not supported by your browser!');
			return;
		}
        $scope.audio_context = audio_context;
		$scope.input = audio_context.createMediaStreamSource($scope.stream);
		
		if($scope.input.context.createJavaScriptNode)
			$scope.node = $scope.input.context.createJavaScriptNode(4096, 1, 1);
		else if($scope.input.context.createScriptProcessor)
			$scope.node = $scope.input.context.createScriptProcessor(4096, 1, 1);
		else
			console.error('Could not create audio node for JavaScript based Audio Processing.');

		//debug:
		console.log('sampleRate: ' + $scope.input.context.sampleRate);

		$scope.node.onaudioprocess = function(e) {
			if (!$scope.recording)
				return;
            // see also: http://typedarray.org/from-microphone-to-wav-with-getusermedia-and-web-audio/
			var channelLeft  = e.inputBuffer.getChannelData(0);
			// var channelRight = e.inputBuffer.getChannelData(1);
			$scope.encoder.postMessage({ cmd: 'encode', buf: channelLeft});
		};

		$scope.input.connect($scope.node);
		$scope.node.connect(audio_context.destination);

		$scope.$apply();
	};

	$scope.stopRecording = function() {
		if (!$scope.recording) {
			return;
		}
		$scope.recordButtonStyle = "red-btn";
		console.log('stop recording');
		$scope.stream.stop();
		$scope.recording = false;
		$scope.encoder.postMessage({ cmd: 'finish' });

		$scope.input.disconnect();
		$scope.node.disconnect();
		$scope.input = $scope.node = null;
	};

	
	$scope.num = 0;


}]);

