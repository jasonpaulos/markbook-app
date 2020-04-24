// INIT
var template = {}
template.bookmarks = []
template.profile = {} // profile to display

var state = {}
state.loggedIn = null
state.user = {} // logged in user
state.query = {} // query string user


function init() {
  addListeners();
  hamburgerHelper();
  processQueryString()
}

function processQueryString() {
  var webId = getQueryStringParam('webid')
  var bookmarkDoc = getQueryStringParam('bookmarkDoc')
  if (webId) {
    state.query.webId = webId
    console.log('init', 'webid', state.query.webId)
    fetchProfile()
  }
  if (bookmarkDoc) {
    state.query.bookmarkDoc = bookmarkDoc.split('#')[0]
    console.log('init', 'bookmarkDoc', state.query.webId)
    fetchBookmarks()
  }
}

// RENDER FUNCTIONS
function render() {
  renderLogin()
  renderApp()
  renderProfile()
  renderBookmarks()
}

function renderLogin() {

  let logout = document.getElementById("logout");
  let login = document.getElementById("login");
  let register = document.getElementById("register")
  let app = document.getElementById("app");

  if (state.loggedIn) {
    logout.style = ""
    register.style.display = "none"
    login.style.display = "none"
  } else {
    logout.style.display = "none"
    login.style.display = ""
    register.style.display = ""
  }
}

function renderApp() {

  let app = document.getElementById("app");

  if (state.loggedIn || state.query.webId || state.query.bookmarkDoc) {
    app.style.display = ""
  } else {
    app.style.display = "none"
  }
}

function renderProfile() {
  console.log('rendering profile', template)
  let user = document.getElementById("user");
  let guidance = document.getElementById("guidance");

  if (state.loggedIn) {
    guidance.style.display = 'none'
  } else {
    guidance.style.display = ''
  }

  if (state.loggedIn || state.query.webId) {
    user.setAttribute("href", template.profile.webId);
    user.style.display = "";
    user.textContent = "Profile";
  }

  if (template.profile.name) {
    document.getElementById("name").textContent = template.profile.name;
  }
  if (template.profile.img) {
    document.getElementById("img").setAttribute("src", template.profile.img);
  }
}

function renderBookmarks() {
  console.log('rendering bookmarks', template)

  let bookmarks = template.bookmarks.sort(function (a, b) {
    createda = a.created;
    createdb = b.created;
    a = new Date(createda);
    b = new Date(createdb);
    return a > b ? -1 : a < b ? 1 : 0;
  })
  document.getElementById("bookmarks").display = ''
  document.getElementById("bookmarks").innerHTML = ''
  for (var i = 0; i < bookmarks.length; i++) {
    let bookmark = bookmarks[i]
    let documentEl = document.getElementById('bookmarks')
    let from = moment(bookmark.created).fromNow()
    if (bookmark.recalls) {
      var recalls = bookmark.recalls
      if (recalls.startsWith('ipfs:')) {
        recalls = 'https://gateway.ipfs.io/ipfs/' + recalls.substring(7)
      }
    }

    let bookmarkEl = `<article class="media">
                  <figure class="media-left">
                    <p class="image is-64x64">
                      <img src="images/markbook.png">
                    </p>
                  </figure>
                  <div class="media-content">
                    <div class="content">
                      <p>
                        <strong>${template.profile.name}</strong>  <small><a target="_blank" href="${bookmark.subject}" style="color: gray">${from}</small>
                        <br>
                        <a target="_blank" href="${recalls}">${bookmark.title}</a>
                      </p>
                    </div>
                    <nav class="level is-mobile">
                      <div class="level-left">
                        <a class="level-item">
                          <span class="icon is-small"><i class="fas fa-reply"></i></span>
                        </a>
                        <a class="level-item">
                          <span class="icon is-small"><i class="fas fa-retweet"></i></span>
                        </a>
                        <a class="level-item">
                          <span class="icon is-small"><i class="fas fa-heart"></i></span>
                        </a>
                      </div>
                    </nav>
                  </div>
                  <div class="media-right">
                    <button class="delete"></button>
                  </div>
                </article>`

    document.getElementById("bookmarks").insertAdjacentHTML('beforeEnd', bookmarkEl)
    /*
    document.getElementById("bookmarks").insertAdjacentHTML('beforeEnd', "<br>")
    document.getElementById("bookmarks").insertAdjacentHTML('beforeEnd', "<br>")
    document.getElementById("bookmarks").insertAdjacentHTML('beforeEnd', "<time><a target='_blank' href='" + bookmark.subject + "'>"+ bookmark.created +"</a></time>")
    */
    document.getElementById("bookmarks").insertAdjacentHTML('beforeEnd', "<hr>")
  }
}

// FETCH
async function fetchProfile() {
  template.profile.webId = state.query.webId || state.user.webId
  const FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');
  const SOLID = $rdf.Namespace('http://www.w3.org/ns/solid/terms#');
  const store = $rdf.graph();
  const fetcher = new $rdf.Fetcher(store);
  // Load the person's data into the store
  await fetcher.load(template.profile.webId);
  // Display their details
  const name = store.any($rdf.sym(template.profile.webId), FOAF('name'));
  const img = store.any($rdf.sym(template.profile.webId), FOAF('img'));
  template.profile.publicTypeIndex = store.any($rdf.sym(template.profile.webId), SOLID('publicTypeIndex'), null, $rdf.sym(template.profile.webId.split('#')[0]));
  //console.log("publicTypeIndex", publicTypeIndex)
  if (name && name.value) {
    template.profile.name = name.value
  }
  if (img && img.value) {
    template.profile.img = img.value
  }
  if (template.profile.publicTypeIndex && template.profile.publicTypeIndex.value) {
    fetchPublicTypeIndex()
  }
  render()
}

async function fetchPublicTypeIndex() {
  const BOOKMARK = $rdf.Namespace('http://www.w3.org/2002/01/bookmark#');
  const SOLID = $rdf.Namespace('http://www.w3.org/ns/solid/terms#');
  const store = $rdf.graph();
  const fetcher = new $rdf.Fetcher(store);
  // Load the person's data into the store
  await fetcher.load(template.profile.publicTypeIndex);
  // Display their details
  template.profile.bookmarkTypeRegistration = store.any(null, SOLID("forClass"), BOOKMARK("Bookmark"))
  console.log("bookmarkTypeRegistration", template.profile.bookmarkTypeRegistration)
  if (template.profile.bookmarkTypeRegistration && template.profile.bookmarkTypeRegistration.value) {
    template.profile.bookmarkInstance = store.any(template.profile.bookmarkTypeRegistration, SOLID("instance"));
    template.profile.bookmarkInstance = template.profile.bookmarkInstance.value
    fetchBookmarks()
  } else {
    console.log("no bookmark files, creating")
    const query = `INSERT DATA {
        <#Bookmark> a <http://www.w3.org/ns/solid/terms#TypeRegistration> ;
          <http://www.w3.org/ns/solid/terms#forClass> <http://www.w3.org/2002/01/bookmark#Bookmark> ;
          <http://www.w3.org/ns/solid/terms#instance> </public/bookmarks.ttl> .
          <> <http://purl.org/dc/terms/references> <#Bookmark> .
        }`
    // Send a PATCH request to update the source
    console.log("sending PATCH query to", template.profile.publicTypeIndex.value, query)
    solid.auth.fetch(template.profile.publicTypeIndex.value, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/sparql-update' },
      body: query,
      credentials: 'include',
    }).then((ret) => {
      console.log("finished", ret)
    })
  }
  render()
}

async function fetchBookmarks() {
  const BOOKMARK = $rdf.Namespace('http://www.w3.org/2002/01/bookmark#');
  const SOLID = $rdf.Namespace('http://www.w3.org/ns/solid/terms#');
  const RDF = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
  const DC = $rdf.Namespace('http://purl.org/dc/terms/')
  const store = $rdf.graph();
  const fetcher = new $rdf.Fetcher(store)
  // Load the person's data into the store
  template.profile.bookmarkInstance = state.query.bookmarkDoc || template.profile.bookmarkInstance
  console.log("bookmarkInstance", template.profile.bookmarkInstance)
  // Display their details
  try {
    await fetcher.load(template.profile.bookmarkInstance)
  } catch (e) {
    console.log('error getting', template.profile.bookmarkInstance)
    console.log(e)
    await solid.auth.fetch(template.profile.bookmarkInstance, {
      method: "PATCH",
      headers: { "content-type": "application/sparql-update" },
      body: ""
    })
  }
  const bookmarks = store.statementsMatching(null, RDF("type"), BOOKMARK("Bookmark"));
  console.log("Bookmarks", bookmarks);
  if (bookmarks && bookmarks.length) {
    template.bookmarks = []
    for (var i = 0; i < bookmarks.length; i++) {
      let bookmark = bookmarks[i]
      let subject = bookmark.subject
      let title = store.any(subject, DC('title'))
      let created = store.any(subject, DC('created'))
      let recalls = store.any(subject, BOOKMARK('recalls'))
      if (subject && recalls && created && title) {
        template.bookmarks.push({
          "subject": subject.value,
          "recalls": recalls.value,
          "created": created.value,
          "title": title.value
        })
      }
      console.log("bookmark " + i, bookmark)
    }
    console.log("template.bookmarks", template.bookmarks)
    render()
  }
  console.log()
}

// HANDLERS
function handleLogin() {
  // login event
  solid.auth.trackSession(session => {
    if (session && session.webId) {
      state.user.webId = session.webId
      state.loggedIn = true
      fetchProfile()
    }
    render()
  })
}

// Log the user in and out on click
function addListeners() {
  let login = document.getElementById("login");
  let logout = document.getElementById("logout");
  let close = document.getElementById("close");
  let cancel = document.getElementById("cancel");
  let save = document.getElementById("save");
  // login and logout buttons
  const popupUri = "./popup.html";
  login.addEventListener("click", () => solid.auth.popupLogin({
    popupUri
  }));
  logout.addEventListener("click", () => {
    state.loggedIn = false
    solid.auth.logout()
  });
  handleLogin();

  add.addEventListener("click", () => {
    document.getElementById('modal').classList.add('is-active')
  })
  close.addEventListener("click", () => {
    document.getElementById('modal').classList.remove('is-active')
  })
  cancel.addEventListener("click", () => {
    document.getElementById('modal').classList.remove('is-active')
  })
  save.addEventListener("click", () => {
    document.getElementById('modal').classList.remove('is-active')
    let id = "#" + Math.random()
    let uri = document.getElementById('uri').value
    let title = document.getElementById('title').value
    let source = template.profile.bookmarkInstance
    let date = new Date().toISOString();
    const query = ` INSERT DATA {
        <${id}> a <http://www.w3.org/2002/01/bookmark#Bookmark> ;
        <http://purl.org/dc/terms/title>   """${title}""" ;
        <http://xmlns.com/foaf/0.1/maker>   <${template.profile.webId}> ;
        <http://purl.org/dc/terms/created>  "${date}"^^<http://www.w3.org/2001/XMLSchema#dateTime> ;
        <http://www.w3.org/2002/01/bookmark#recalls> <${uri}> .
        <> <http://purl.org/dc/terms/references> <${id}> .
      }`
    // Send a PATCH request to update the source
    console.log("query", query)
    solid.auth.fetch(source, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/sparql-update' },
      body: query,
      credentials: 'include',
    }).then((ret) => {
      console.log("finished", ret)
      location.reload()
    }).catch(err => {
      console.log("error updating", source, err)
    })
  })

}


// HELPERS
function hamburgerHelper() {
  document.querySelector(".navbar-burger").addEventListener("click", toggleNav);

  function toggleNav() {
    var nav = document.querySelector(".navbar-menu");
    if (nav.className == "navbar-menu") {
      nav.className = "navbar-menu is-active";
    } else {
      nav.className = "navbar-menu";
    }
  }
}

function getQueryStringParam(param) {
  var url = window.location.toString();
  url.match(/\?(.+)$/);
  var params = RegExp.$1;
  params = params.split("&");
  var queryStringList = {};
  for (var i = 0; i < params.length; i++) {
    var tmp = params[i].split("=");
    queryStringList[tmp[0]] = unescape(tmp[1]);
  }
  return queryStringList[param];
}


// MAIN
init()
