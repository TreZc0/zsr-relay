'use strict';

/*
 * NOTE: It is absolutely critical that the `args` param of any udpPort.send command not be null or undefined.
 * Doing so causes the osc lib to actually encode it as a null argument (,N). Instead, use an empty array ([]).
 */

// Packages
const clone = require('clone');
const osc = require('osc');

// Ours
const nodecg = require('./util/nodecg-api-context').get();

const X32_UDP_PORT = 10023;
const FADE_THRESHOLD = 0.10;
const DEFAULT_CHANNEL_OBJ = {
	audio: {muted: true}
};

const gameAudioChannels = nodecg.Replicant('gameAudioChannels', {
	defaultValue: [
		clone(DEFAULT_CHANNEL_OBJ),
		clone(DEFAULT_CHANNEL_OBJ),
		clone(DEFAULT_CHANNEL_OBJ),
		clone(DEFAULT_CHANNEL_OBJ)
	],
	persistent: false
});

const twitchPlayer = nodecg.Replicant('twitchPlayer');

twitchPlayer.on('change', newVal =>
{
    if (newVal)
	{
	    if (newVal.playerInstanceCreated)
	    {
	        if (newVal.streamARunning || newVal.streamBRunning || newVal.streamCRunning || newVal.streamDRunning)
	        {
	            if (newVal.streamAMuted || newVal.streamAVolume < 0.03)
	            {
	                gameAudioChannels.value[0].audio.muted = true;
	            }
	            else
	            {
	                gameAudioChannels.value[0].audio.muted = false;
	            }

	            if (newVal.streamBMuted || newVal.streamBVolume < 0.05)
	            {
	                gameAudioChannels.value[1].audio.muted = true;
	            }
	            else
	            {
	                gameAudioChannels.value[1].audio.muted = false;
	            }

                if (newVal.streamCMuted || newVal.streamCVolume < 0.05)
	            {
	                gameAudioChannels.value[2].audio.muted = true;
	            }
	            else
	            {
	                gameAudioChannels.value[2].audio.muted = false;
	            }

                if (newVal.streamDMuted || newVal.streamDVolume < 0.05)
	            {
	                gameAudioChannels.value[3].audio.muted = true;
	            }
	            else
	            {
	                gameAudioChannels.value[3].audio.muted = false;
	            }
	        }
	    }
	 }
});
