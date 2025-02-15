const fs = require('fs')
const axios = require('axios')
const { S3Client } = require('@aws-sdk/client-s3')
const {
  AWS_BUCKET_REGION,
  AWS_PUBLIC_KEY,
  AWS_SECRET_KEY,
  AWS_BUCKET_NAME,
  AWS_ENDPOINT,
} = require('../config.js')

const client = new S3Client({
  region: AWS_BUCKET_REGION,
  credentials: {
    accessKeyId: AWS_PUBLIC_KEY,
    secretAccessKey: AWS_SECRET_KEY,
  },
  endpoint: AWS_ENDPOINT,
})
async function uploadFile(file) {
  const stream = fs.createReadStream(file.tempFilePath)
  const uploadParams = {
    Bucket: AWS_BUCKET_NAME,
    Key: file.name,
    Body: stream,
  }
  const command = new PutObjectCommand(uploadParams)
  return await client.send(command)
}

async function getFiles() {
  const command = new ListObjectsCommand({
    Bucket: AWS_BUCKET_NAME,
  })

  return await client.send(command)
}

async function getFile(filename) {
  const command = new GetObjectCommand({
    Bucket: AWS_BUCKET_NAME,
    Key: filename,
  })
  return await client.send(command)
}

async function downloadFile(filename) {
  const command = new GetObjectCommand({
    Bucket: AWS_BUCKET_NAME,
    Key: filename,
  })
  const result = await client.send(command)
  console.log(result)
  result.Body.pipe(fs.createWriteStream(`./images/${filename}`))
}

async function getFileURL(filename) {
  const command = new GetObjectCommand({
    Bucket: AWS_BUCKET_NAME,
    Key: filename,
  })
  return await getSignedUrl(client, command, { expiresIn: 3600 })
}
module.exports = {
  client,
  uploadFile,
  getFiles,
  getFile,
  downloadFile,
  getFileURL,
}
