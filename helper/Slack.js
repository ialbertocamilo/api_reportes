const axios = require('axios')

exports.reportErrorInSlackError = async (message) => {
  try {
    await axios({
      url: process.env.SLACK_URL,
      method: 'post',
      data: {
        text: message
      }
    })
  } catch (ex) {
    console.log(ex)
  }
}
