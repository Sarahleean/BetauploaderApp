const axios = require('axios');
const express = require('express');
const multer = require('multer');
const { Dropbox } = require('dropbox');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: 'uploads/' });

const dbx = new Dropbox({
  // clientId: appKey,
  // clientSecret: appSecret,
  // refreshToken: refreshToken,
});

let accessToken = null;
let refreshToken = null;

const MydropboxAppKey = '72k4rjgio5xik7f';
const MydropboxAppSecret = '5qkialtd2pmpu4y';

const counterFile = 'textFileCounter.json';

// Initialize the counter
if (!fs.existsSync(counterFile)) {
  fs.writeFileSync(counterFile, JSON.stringify({ counter: 1 }));
}

function getTextFileCounter() {
  const data = fs.readFileSync(counterFile, 'utf8');
  return JSON.parse(data).counter;
}

function incrementTextFileCounter() {
  const counter = getTextFileCounter() + 1;
  fs.writeFileSync(counterFile, JSON.stringify({ counter }));
  return counter;
}

async function getAccessToken() {
  try {
    const response = await axios.post('https://api.dropboxapi.com/oauth2/token', {
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      client_id: MydropboxAppKey,
      client_secret: MydropboxAppSecret,
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      transformRequest: [(data) => {
        return Object.keys(data).map((key) => {
          return `${key}=${data[key]}`;
        }).join('&');
      }],
    });

    accessToken = response.data.access_token;
    dbx.auth.setAccessToken(accessToken);
  } catch (error) {
      console.error('Error refreshing access token:', error);
    }
}

async function initAccessToken(code) {
  try {
    const params = new URLSearchParams();
    params.append('code', code);
    params.append('grant_type', 'authorization_code');
    params.append('client_id', MydropboxAppKey);
    params.append('client_secret', MydropboxAppSecret);
    params.append('redirect_uri', 'https://betauploaderapp.onrender.com/callback');

    const response = await axios.post('https://api.dropboxapi.com/oauth2/token', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    accessToken = response.data.access_token;
    refreshToken = response.data.refresh_token;
    dbx.auth.setAccessToken(accessToken);
  } catch (error) {
    console.error('Error exchanging authorization code:', error);
  }
}

// app.get('/auth', (req, res) => {
//   const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${MydropboxAppKey}&response_type=code&redirect_uri=http://localhost:3000/callback`;
//   res.redirect(authUrl);
// });

app.get('/', (req, res) => {
  fs.readFile('index.html', (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Error loading index.html');
    } else {
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(data);
    }
  });
});


app.use(express.static(__dirname));
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  await initAccessToken(code);
  res.send('Authorized!');
});

app.post('/upload', upload.any(), async (req, res) => {
  console.log(req.files);
  console.log(req.body);
  if (!accessToken) {
    res.status(401).send('Not authorized');
    return;
  }

  try {
    req.files.forEach(async (file) => {
      const fileBuffer = fs.readFileSync(file.path);
      await dbx.filesUpload({
        path: `/Apps/File-Uploader2025/${file.originalname}`,
        contents: fileBuffer,
        mode: 'add',
      });

      console.log('File uploaded successfully');
      fs.unlinkSync(file.path); // Remove the temporary file
    });

    let textFileCounter = getTextFileCounter();
    const textKeys = Object.keys(req.body).filter(key => key.startsWith('text'));
    for (let i = 0; i < textKeys.length; i++) {
      const key = textKeys[i];
      const textBuffer = Buffer.from(req.body[key], 'utf8');
      const textFileName = `/Apps/File-Uploader2025/text${textFileCounter}.txt`;
      console.log(`Uploading text file: ${textFileName}`);

      await dbx.filesUpload({
        path: textFileName,
        contents: textBuffer,
        mode: 'add',
      });

      console.log('Text file uploaded successfully');

      textFileCounter++;
    }
    fs.writeFileSync(counterFile, JSON.stringify({ counter: textFileCounter }));

    res.send(`Files and texts uploaded successfully!`);
  } catch (error) {
    console.error('Error uploading files or texts:', error);
    res.status(500).send(`Error uploading files or texts.`);
  }
});

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
