const fs = require('fs')

const { AWS_BUCKET_NAME, MARCA } = require('../config.js')
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

const { client } = require('../helper/s3-helpers.js')
const uploadFile = async (filePath) => {
  try {
    const fileStream = fs.createReadStream('./' + filePath)
    const keyFile = MARCA + fileStream.path.slice(1)
    const compressedCommand = new PutObjectCommand({
      Bucket: AWS_BUCKET_NAME,
      Key: keyFile,
      Body: fileStream,
    })
    await client.send(compressedCommand)
    console.log(`Uploaded successfully! ${keyFile} `)
    fs.unlinkSync(filePath)
  } catch (err) {
    console.error(err)
  }
}

async function downloadFile(filePath) {
  try{
    const expiresIn = 60 * 5
  
    const command = new GetObjectCommand({
      Bucket: AWS_BUCKET_NAME,
      Key: `${MARCA}/reports/${filePath}`,
    })
    const url = await getSignedUrl(client, command, { expiresIn })
    return url
  } catch (err) {
    console.log(err)
  }  
  
}

module.exports = { uploadFile, downloadFile }
