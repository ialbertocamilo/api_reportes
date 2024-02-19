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
    console.log('filePath in uploadFile',filePath);
    console.log('fileName in uploadFile',fileName);
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

function downloadFile(filePath,expiresIn=300,from_reports=true) {
  if(from_reports){
    filePath = `reports/${filePath}`
  }
  try{
    if(!filePath ) return
    const command = new GetObjectCommand({
      Bucket: AWS_BUCKET_NAME,
      Key: `${MARCA}/${filePath}`,
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
  console.log('fileNames',fileNames);
  for (const filepath of fileNames) {
      const pdfFileName = filepath.split('/')[1];
      console.log(filepath,'filepath');
      const {content} = await downloadFileFromS3(filepath);
      zipStream.append(content, { name: pdfFileName });
  }
  // zipWriteStream.on('close', async () => {
  //     const zipReadFileStream = fs.createReadStream(zipFileName);
  //     console.log(`Archivos PDF comprimidos y cargados como ${zipFileName}`);
  // });
  const closeEventPromise = new Promise((resolve) => {
    zipWriteStream.on('close', () => {
      console.log(`Archivos PDF comprimidos y cargados como ${zipFileName}`);
      resolve();
    });
  });
  zipStream.finalize();
  await closeEventPromise;
  console.log('zipFileName in zipAndUploadFilesInS3',zipFileName);
  await uploadFile(zipFileName,false);
}
async function zipPdfsAndUploadFilesInS3(pdfs, zipFileName) {
  zipFileName = CARPETA_DESCARGA+'/'+zipFileName;
  const zipStream = archiver('zip', { zlib: { level: 9 } });
  const zipWriteStream = fs.createWriteStream(zipFileName);
  zipStream.pipe(zipWriteStream);

  for (const pdf of pdfs) {
    zipStream.append(fs.createReadStream(pdf.filePath), { name: pdf.folder_name+'/'+pdf.filename });
  }
  // zipStream.finalize();
    await new Promise((resolve, reject) => {
      zipWriteStream.on('close', () => {
          resolve();
      });
      zipWriteStream.on('error', (err) => {
          reject(err);
      });
      zipStream.finalize();
  });

  // Cargar el archivo ZIP en S3 después de que se haya completado la escritura
  await uploadFile(zipFileName);
}

module.exports = { uploadFile, downloadFile ,zipAndUploadFilesInS3,zipPdfsAndUploadFilesInS3}
