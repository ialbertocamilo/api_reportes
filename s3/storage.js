const fs = require('fs')
const path = require('path')

const { AWS_BUCKET_NAME, MARCA } = require('../config.js')
const { PutObjectCommand,GetObjectCommand } = require('@aws-sdk/client-s3')

const { client } = require('../helper/s3-helpers.js')

const uploadFile =async (filePath) => {
  try {
    const fileStream = fs.createReadStream('./'+filePath)
    const keyFile = MARCA  + fileStream.path.slice(1)
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
const downloadFile = async (filePath, res) => {
  try {
    const keyFile = `${MARCA}/reports/${filePath}`
    const params = {
      Bucket: AWS_BUCKET_NAME,
      Key: keyFile
    }
    const command = new GetObjectCommand(params)
    const result = await client.send(command)

    res.send(result.Body);

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Error al descargar el archivo." });
  }
}

module.exports = { uploadFile, downloadFile  }
