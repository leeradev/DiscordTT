var name = ['/play '];
var description = 'Plays a song.';
var usage = '`/play [YouTube ID]`: Plays a song with the given YouTube ID (the string after `https://youtube.com/watch?v=`). The bot will play the song in the voice channel you\'re connected to.';

var messageHandler = require(global.paths.lib + 'message-handler');
var tt = require(global.paths.lib + 'turntable-handler');
var google = require('googleapis');
var youtube = google.youtube('v3');
var Discord = require('discord.js');
var uuid = require('uuid/v4');

var handleMessage = function(bot, message) {
  // TODO: This will need to occur in a lib handler
  // TODO: This loop will act as the bot's main event loop when a DJ session is active
  // TODO: Optimize for bandwidth constraints (e.g. cache downloaded songs)

  if (message.content.length < 6) {
    return message.reply('no results found.');
  }

  var searchParameters = message.content.substring(6, message.content.length);

  youtube.search.list({
    key: config.api.youtube,
    part: 'snippet',
    type: 'video',
    maxResults: 3,
    q: searchParameters
  }, function(error, response) {
    if (error) {
      return console.warn('An error occurred while searching YouTube', error);
    }

    if (response.items[0]) {
      var embed = new Discord.RichEmbed();

      embed.setAuthor(bot.user.username, bot.user.avatarURL);
      embed.setFooter('Requested by ' + message.author.username, message.author.avatarURL);
      embed.setTimestamp(new Date());

      embed.setTitle('Select a song to play');

      var description = '_Respond within 10 seconds with the number of the song you\'d like to play_\n\n';

      for (var i in response.items) {
        description += (parseInt(i) + 1) + ') [' + response.items[i].snippet.title +'](https://www.youtube.com/watch?v=' + response.items[i].id.videoId + ')\n';
      }

      embed.setDescription(description);

      console.log('adding request');

      var id = uuid();

      messageHandler.addRequest({
        type: 'queue',
        message: message,
        data: response.items,
        created: new Date(),
        handler: handleActiveRequest,
        id: id
      });

      var requestHandler = function(id) {
        console.log('Removing request ' + id);
        messageHandler.removeRequest(id);
      };

      // Remove this handler after 10 seconds, if it hasn't already been handled
      setTimeout(requestHandler.bind(this, id), 10000);

      message.channel.send('', { embed: embed });
    }
  });


  if (message.content.length < 6) {
    return message.reply('please provide a YouTube video ID.');
  }
};

var matches = function(input) {
  return _.startsWith(input, '/play ') || input == '/play';
};

var handleActiveRequest = function(bot, message, request) {
  console.log('handling request from play');

  var content = message.content.trim();

  if (message.content >= 1 && message.content <= 3) {
    // Get YT ID for this result
    var item = request.data[parseInt(message.content)];
    if (item) {
      var youtubeId = item.id.videoId;

      // Invoke song player
      tt.playSong(bot, message.member.voiceChannel, 'https://www.youtube.com/watch?v=' + youtubeId);

      // Send back a Now Playing message\
      var embed = new Discord.RichEmbed();

      embed.setThumbnail(item.snippet.thumbnails.medium.url);
      embed.setFooter('Queued by DJ ' + message.author.username, message.author.avatarURL);
      embed.setTimestamp(new Date());
      embed.setAuthor(bot.user.username, bot.user.avatarURL);
      embed.setTitle('Now Playing');
      embed.setDescription(item.snippet.title);

      var promise = message.channel.send('', { embed: embed });
      promise.then(function(message) {
        var upvotePromise = message.react('👍');
        upvotePromise.then(function(messageReaction) {
          messageReaction.message.react('👎');
        });
      });

      // Remove this request from the active queue
      messageHandler.removeRequest(request.id);
    }
  }
};

module.exports = {
  name: name,
  description: description,
  usage: usage,
  handleMessage: handleMessage,
  handleActiveRequest: handleActiveRequest,
  matches: matches
};
