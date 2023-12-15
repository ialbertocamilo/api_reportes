const fs = require('fs')
const path = require('path');
const { AWS_BUCKET_NAME, MARCA } = require('../config.js')
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { CARPETA_DESCARGA } = require("../config");
const { client } = require('../helper/s3-helpers.js')
const archiver = require('archiver');

const uploadFile = async (filePath,unlinkfile=true) => {
  try {
    if(filePath === undefined) return
    const fileName = path.basename(filePath);
    const fileStream = fs.createReadStream(CARPETA_DESCARGA+'/'+fileName)
    console.log('CARPETA_DESCARGA',CARPETA_DESCARGA+'/'+fileName)
    const keyFile = MARCA +'/reports/'+ fileName
     console.log('keyFile',keyFile)
    const compressedCommand = new PutObjectCommand({
      Bucket: AWS_BUCKET_NAME,
      Key: keyFile,
      Body: fileStream,
    })
    await client.send(compressedCommand)
    if(unlinkfile){
      fs.unlinkSync(CARPETA_DESCARGA+'/'+fileName)
    }
  } catch (err) {
    console.error(err)
  }
}

function downloadFile(filePath) {
  try{
    if(!filePath ) return
    const expiresIn = 60 * 5
    console.log(filePath);
    const command = new GetObjectCommand({
      Bucket: AWS_BUCKET_NAME,
      Key: `${MARCA}/reports/${filePath}`,
    })
    const url = getSignedUrl(client, command, { expiresIn })
    console.log(url);
    return url
  } catch (err) {
    console.log(err)
  }  
  
}
// Zipea un listado de archivos almacenados en el s3, y sube el mismo zip al s3 para su posterior descarga
async function zipAndUploadFilesInS3(fileNames, zipFileName) {
  zipFileName = CARPETA_DESCARGA+'/'+zipFileName
  const zipStream = archiver('zip');
  const zipWriteStream = fs.createWriteStream(zipFileName);
  zipStream.pipe(zipWriteStream);
  for (const filepath of fileNames) {
      const pdfFileName = filepath.split('/')[1];
      const {content} = await downloadFileFromS3(filepath);
      zipStream.append(content, { name: pdfFileName });
  }
  zipWriteStream.on('close', async () => {
      const zipReadFileStream = fs.createReadStream(zipFileName);
      console.log(`Archivos PDF comprimidos y cargados como ${zipFileName}`);
  });
  zipStream.finalize();
  await uploadFile(zipFileName,false);
}
async function downloadFileFromS3(fileName) {
  // try {
    console.log('entra');
    const s3Params = {
      Bucket: AWS_BUCKET_NAME,
      Key: `${MARCA}/${fileName}`,
    };
    const getObjectCommand = new GetObjectCommand(s3Params);
    const {Body} = await client.send(getObjectCommand);
    return { name: fileName, content: Body };
}
module.exports = { uploadFile, downloadFile ,zipAndUploadFilesInS3}
