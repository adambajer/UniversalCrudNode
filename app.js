const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const firebase = require('firebase/app');
require('firebase/database');

const app = express();
const viewPort = process.env.PORT || 3000;

// Firebase configuration
const firebaseConfig = {
  databaseURL: "https://voice-noter-default-rtdb.europe-west1.firebasedatabase.app",
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const database = firebase.database();

// Set views directory and view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware
app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// Middleware for logging requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} request for ${req.url}`);
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to fetch pages, settings, and tables from Firebase
async function fetchDataMiddleware(req, res, next) {
  try {
    console.log('Fetching data from Firebase...');
    const settingsSnapshot = await database.ref('crudsettings').once('value');
    const settings = settingsSnapshot.val() || {};

    const pagesSnapshot = await database.ref('pages').once('value');
    const pages = pagesSnapshot.val() || {};

    const crudtablesSnapshot = await database.ref('crudtables').once('value');
    const crudtables = crudtablesSnapshot.val() || {};

    res.locals.settings = settings;
    res.locals.pages = pages;
    res.locals.crudtables = crudtables;

    console.log('Data fetched successfully.');
    next();
  } catch (error) {
    console.error('Error fetching data from Firebase:', error);
    res.status(500).send('Internal Server Error');
  }
}

// Apply fetchDataMiddleware only to specific routes that need it
app.use(['/settings', '/pages', '/tables'], fetchDataMiddleware);

// Default route to serve static index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Create page route
app.post('/create/page', async (req, res) => {
  try {
    console.log('Creating new page...');
    const { name, content } = req.body;
    const newPageRef = database.ref('pages').push();
    await newPageRef.set({ name, content });
    console.log('New page created.');
    res.redirect('/');
  } catch (error) {
    console.error('Error creating new page:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch settings
app.get('/settings', async (req, res) => {
  try {
    console.log('Rendering settings...');
    res.render('settings', { settingsData: res.locals.settings });
    console.log('Settings rendered successfully.');
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Fetch individual page
app.get('/pages/:pageName', async (req, res) => {
  try {
    const pageName = req.params.pageName;
    console.log(`Fetching page: ${pageName}...`);
    const pagesSnapshot = await database.ref('pages').orderByChild('name').equalTo(pageName).once('value');
    const pageData = pagesSnapshot.val();

    if (!pageData) {
      console.log('Page not found.');
      res.status(404).send('Page not found');
      return;
    }

    const page = Object.values(pageData)[0];
    const contentSnapshot = await database.ref(`content/${page.contentid}`).once('value');
    const content = contentSnapshot.val();

    console.log('Rendering page...');
    res.render('pages', {
      pageName: page.name,
      pageId: page.contentid,
      content: content.content,
      parentId: page.parentid,
      createdby: page.createdby,
      createdat: page.createdat,
      breadcrumbTrail: await buildBreadcrumbTrail(page.parentid)
    });
    console.log('Page rendered successfully.');
  } catch (error) {
    console.error('Error fetching page details:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Function to build breadcrumb trail
async function buildBreadcrumbTrail(parentId) {
  const breadcrumbTrail = [];
  while (parentId) {
    const parentSnapshot = await database.ref(`pages/${parentId}`).once('value');
    const parent = parentSnapshot.val();
    breadcrumbTrail.push({ id: parentId, name: parent.name });
    parentId = parent.parentid;
  }
  return breadcrumbTrail.reverse();
}

// Fetch tables
app.get('/tables', async (req, res) => {
  try {
    console.log('Rendering tables...');
    res.render('tables', { crudtables: res.locals.crudtables });
    console.log('Tables rendered successfully.');
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch individual table
app.get('/tables/:tableName', async (req, res) => {
  try {
    const tableName = req.params.tableName;
    console.log(`Fetching table: ${tableName}...`);
    const tableSnapshot = await database.ref(`crudtables`).orderByChild('name').equalTo(tableName).once('value');
    const tableData = tableSnapshot.val();
    const table = Object.values(tableData)[0];
    const recordsSnapshot = await database.ref(`tables/${tableName}`).once('value');
    const records = recordsSnapshot.val();

    console.log('Rendering table...');
    res.render('table', { tableName, table, records });
    console.log('Table rendered successfully.');
  } catch (error) {
    console.error('Error fetching table details:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Delete page
app.get('/pages/delete/:id', async (req, res) => {
  try {
    const pageId = req.params.id;
    console.log(`Deleting page: ${pageId}...`);
    await database.ref(`pages/${pageId}`).remove();
    console.log('Page deleted.');
    res.redirect('/');
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Update page content
app.post('/pages/update/:id', async (req, res) => {
  try {
    const pageId = req.params.id;
    console.log(`Updating page content: ${pageId}...`);
    const { content } = req.body;
    await database.ref(`content/${pageId}`).update({ content });
    console.log('Page content updated.');
    res.redirect(`/pages/${pageId}`);
  } catch (error) {
    console.error('Error updating page content:', error);
    res.status(500).send('Error updating page content');
  }
});

// Start the server
app.listen(viewPort, (err) => {
  if (err) {
    console.error('Error starting the view server:', err);
    return;
  }
  console.log(`View server is running on port ${viewPort}`);
});
