import React, { Component } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StatusBar,
  FlatList,
  Button,
  Linking,
  TouchableHighlight,
  StyleSheet,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import Modal from 'react-native-modal';
import * as rdf from '@jasonpaulos/rdflib';
import {
  init as initAuth,
  onSessionChange,
  authenticatedFetch,
  logIn,
  logOut
} from './auth';
import { Bookmark, BookmarkComponent } from './Bookmark';

const FOAF = rdf.Namespace('http://xmlns.com/foaf/0.1/');
const SOLID = rdf.Namespace('http://www.w3.org/ns/solid/terms#');
const BOOKMARK = rdf.Namespace('http://www.w3.org/2002/01/bookmark#');
const RDF = rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
const DC = rdf.Namespace('http://purl.org/dc/terms/');

interface Props {

}

interface Profile {
  webId: string,
  name?: string,
  image?: string
  publicTypeIndex?: string,
  bookmarkInstance?: string,
}

interface State {
  profile: Profile | null,
  bookmarks: Bookmark[],
  loadingBookmarks: boolean,
  editing: boolean,
  addModal: boolean,
  newBookmarkTitle: string,
  newBookmarkUri: string,
}

export class App extends Component<Props, State> {

  cleanupAuth?: () => any;
  cleanupSession?: () => any; 

  constructor(props: Props) {
    super(props);
    this.state = {
      profile: null,
      bookmarks: [],
      editing: false,
      loadingBookmarks: false,
      addModal: false,
      newBookmarkTitle: '',
      newBookmarkUri: '',
    };
  }

  componentDidMount() {
    this.cleanupAuth = initAuth();
    this.cleanupSession = onSessionChange(this.newSession.bind(this));
  }

  componentWillUnmount() {
    if (this.cleanupSession) {
      this.cleanupSession();
    }
    if (this.cleanupAuth) {
      this.cleanupAuth();
    }
  }

  async newSession(session: { webId: string } | null) {
    if (!session) {
      this.setState({ profile: null, bookmarks: [] });
      return;
    }
    
    let profile;
    try {
      profile = await this.fetchProfile(session.webId);
      if (!profile.publicTypeIndex) {
        this.setState({ profile: null, bookmarks: [] });
        Alert.alert('Cannot load bookmarks', 'Profile card does not have publicTypeIndex');
        return;
      }
      this.setState({ profile, loadingBookmarks: true });
    } catch (err) {
      console.warn(err);
      Alert.alert('Failed to log in', err.toString());
      return;
    }

    try {
      const bookmarkInstance = await this.fetchPublicTypeIndex(profile.publicTypeIndex);
      if (!bookmarkInstance) {
        this.setState({ bookmarks: [], loadingBookmarks: false });
        Alert.alert('Cannot load bookmarks', 'Profile card does not have publicTypeIndex');
        return;
      }
      profile.bookmarkInstance = bookmarkInstance;
      this.setState({ profile });
    } catch (err) {
      console.warn(err);
      Alert.alert('Failed to log in', err.toString());
      return;
    }

    try {
      const bookmarks = await this.fetchBookmarks(profile.bookmarkInstance);
      this.setState({ bookmarks, loadingBookmarks: false });
    } catch (err) {
      this.setState({ bookmarks: [], loadingBookmarks: false });
      console.warn(err);
      Alert.alert('Failed to load bookmarks', err.toString());
      return;
    }
  }

  async fetchProfile(webId: string): Promise<Profile> {
    const store = rdf.graph();
    const fetcher = new rdf.Fetcher(store, { fetch: authenticatedFetch });
    const profile: Profile = { webId };

    await fetcher.load(webId);

    const name = store.any(rdf.sym(webId), FOAF('name'));
    const img = store.any(rdf.sym(webId), FOAF('img'));
    const publicTypeIndex = store.any(rdf.sym(webId), SOLID('publicTypeIndex'), null, rdf.sym(webId.split('#')[0]));
    
    if (name && name.value) {
      profile.name = name.value;
    }
    if (img && img.value) {
      profile.image = img.value;
    }
    if (publicTypeIndex && publicTypeIndex.value) {
      profile.publicTypeIndex = publicTypeIndex.value;
    }

    return profile;
  }

  async fetchPublicTypeIndex(publicTypeIndex: string): Promise<string | null> {
    const store = rdf.graph();
    const fetcher = new rdf.Fetcher(store, { fetch: authenticatedFetch });

    await fetcher.load(publicTypeIndex);

    const bookmarkTypeRegistration = store.any(null, SOLID("forClass"), BOOKMARK("Bookmark"));
    if (bookmarkTypeRegistration && bookmarkTypeRegistration.value && bookmarkTypeRegistration.termType === "NamedNode") {
      const bookmarkInstance = store.any(bookmarkTypeRegistration as rdf.NamedNode, SOLID("instance"));
      if (bookmarkInstance && bookmarkInstance.value) {
        return bookmarkInstance.value;
      }
    } else {
      const query = `INSERT DATA {
        <#Bookmark> a <http://www.w3.org/ns/solid/terms#TypeRegistration> ;
          <http://www.w3.org/ns/solid/terms#forClass> <http://www.w3.org/2002/01/bookmark#Bookmark> ;
          <http://www.w3.org/ns/solid/terms#instance> </public/bookmarks.ttl> .
          <> <http://purl.org/dc/terms/references> <#Bookmark> .
        }`;
      const ret = await authenticatedFetch(publicTypeIndex, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/sparql-update' },
        body: query,
        credentials: 'include',
      });
    }

    return null;
  }

  refreshBookmarks = () => {
    if (this.state.profile == null || this.state.profile.bookmarkInstance == null) {
      return;
    }

    const { bookmarkInstance } = this.state.profile;

    this.setState({ loadingBookmarks: true }, async () => {
      try {
        const bookmarks = await this.fetchBookmarks(bookmarkInstance);
        this.setState({ loadingBookmarks: false, bookmarks });
      } catch (err) {
        this.setState({ loadingBookmarks: false });
        console.warn(err);
        Alert.alert('Failed to load bookmarks', err.toString());
      }
    });
  }

  async fetchBookmarks(bookmarkInstance: string): Promise<Bookmark[]> {
    const store = rdf.graph();
    const fetcher = new rdf.Fetcher(store, { fetch: authenticatedFetch });

    try {
      await fetcher.load(bookmarkInstance);
    } catch (e) {
      await authenticatedFetch(bookmarkInstance, {
        method: "PATCH",
        headers: { "content-type": "application/sparql-update" },
        body: ""
      });
    }

    const bookmarkList: Bookmark[] = [];
    const bookmarks = store.statementsMatching(null, RDF("type"), BOOKMARK("Bookmark"));
    if (bookmarks && bookmarks.length) {
      for (let i = 0; i < bookmarks.length; i++) {
        const bookmark = bookmarks[i];
        const subject = bookmark.subject;
        const title = store.any(subject, DC('title'));
        const created = store.any(subject, DC('created'));
        const recalls = store.any(subject, BOOKMARK('recalls'));
        if (subject && recalls && created && title) {
          bookmarkList.push({
            subject: subject.value,
            recalls: recalls.value,
            created: created.value,
            title: title.value,
            selected: false,
          });
        }
      }
    }

    bookmarkList.sort((a, b) => {
      const createda = new Date(a.created);
      const createdb = new Date(b.created);
      return createda > createdb ? -1 : createda < createdb ? 1 : 0;
    });

    return bookmarkList;
  }

  createBookmark = async () => {
    const uri = this.state.newBookmarkUri;
    const title = this.state.newBookmarkTitle;
    this.setState({
      newBookmarkTitle: '',
      newBookmarkUri: '',
      addModal: false,
    })
    try {
      if (this.state.profile == null || this.state.profile.bookmarkInstance == null || this.state.bookmarks == null) {
        throw new Error('Invalid bookmark instance');
      }

      const id = "#" + Math.random();
      const creator = this.state.profile.webId;
      const source = this.state.profile.bookmarkInstance;
      const date = new Date().toISOString();
      const query = ` INSERT DATA {
          <${id}> a <http://www.w3.org/2002/01/bookmark#Bookmark> ;
          <http://purl.org/dc/terms/title>   """${title}""" ;
          <http://xmlns.com/foaf/0.1/maker>   <${creator}> ;
          <http://purl.org/dc/terms/created>  "${date}"^^<http://www.w3.org/2001/XMLSchema#dateTime> ;
          <http://www.w3.org/2002/01/bookmark#recalls> <${uri}> .
          <> <http://purl.org/dc/terms/references> <${id}> .
        }`;
      // Send a PATCH request to update the source
      const ret = await authenticatedFetch(source, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/sparql-update' },
        body: query,
        credentials: 'include',
      });

      if (!ret.ok) {
        throw new Error(`Invalid status: ${ret.status}`);
      }

      const newBookmark: Bookmark = {
        subject: id,
        recalls: uri,
        created: date,
        title,
        selected: false,
      };

      this.setState({
        bookmarks: [newBookmark, ...this.state.bookmarks],
      });
    } catch (err) {
      console.warn(err);
      Alert.alert('Could not create bookmark', err.toString());
    }
  }

  toggleNewBookmarkModal = () => {
    this.setState((state, props) => {
      return { addModal: !state.addModal };
    });
  }

  selectBookmark(subject: string) {
    this.setState((state, props) => {
      let { bookmarks } = state;

      if (bookmarks != null) {
        bookmarks = bookmarks.map(bm => {
          if (bm.subject != subject) {
            return bm;
          }
          const { selected, ...other } = bm;
          return {
            selected: !selected,
            ...other,
          };
        });
      }

      return { bookmarks };
    });
  }

  startEditing = () => {
    this.setState({ editing: true });
  }

  cancelEditing = () => {
    this.setState((state, props) => {
      let { bookmarks } = state;

      if (bookmarks != null) {
        bookmarks = bookmarks.map(bm => {
          const { selected, ...other } = bm;
          return {
            selected: false,
            ...other,
          };
        });
      }

      return { bookmarks, editing: false };
    });
  }

  async deleteBookmark(bookmark: Bookmark) {
    const query = `DELETE DATA {
        <${bookmark.subject}> a <http://www.w3.org/2002/01/bookmark#Bookmark> ;
            <http://purl.org/dc/terms/title>   """${bookmark.title}""" ;
            <http://xmlns.com/foaf/0.1/maker>   <${this.state.profile?.webId}> ;
            <http://purl.org/dc/terms/created>  "${bookmark.created}"^^<http://www.w3.org/2001/XMLSchema#dateTime> ;
            <http://www.w3.org/2002/01/bookmark#recalls> <${bookmark.recalls}> .
            <> <http://purl.org/dc/terms/references> <${bookmark.subject}> .
      }`;
    // Send a PATCH request to update the source
    const ret = await authenticatedFetch(this.state.profile?.bookmarkInstance, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/sparql-update' },
      body: query,
      credentials: 'include',
    });

    if (!ret.ok) {
      throw new Error(`Invalid status: ${ret.status}`);
    }
  }

  deleteEditing = async () => {
    try {
      this.setState({ loadingBookmarks: true });

      const selected: Bookmark[] = [];
      const notSelected: Bookmark[] = [];
      for (const bookmark of this.state.bookmarks!) {
        (bookmark.selected ? selected : notSelected).push(bookmark);
      }

      for (const bookmark of selected) {
        await this.deleteBookmark(bookmark);
      }
  
      this.setState({
        loadingBookmarks: false,
        editing: false,
        bookmarks: notSelected,
      });
    } catch (err) {
      console.warn(err);
      Alert.alert('Could not delete selected', err.toString());
      this.setState({ loadingBookmarks: false, editing: false });
    }
  }

  async openLink(link: string) {
    try {
      if (link && link.startsWith('ipfs:')) {
        link = 'https://gateway.ipfs.io/ipfs/' + link.substring(7);
      }
      await Linking.openURL(link);
    } catch (err) {
      console.warn('Failed to open URL', link, err);
    }
  }

  renderBookmark = ({ item }: { item: Bookmark }) => {
    const creator = this.state.profile ? this.state.profile.name : null;
    return (
      <BookmarkComponent
        creator={creator || 'You'}
        bookmark={item}
        editing={this.state.editing}
        onPress={() => {
          if (this.state.editing) {
            this.selectBookmark(item.subject);
          } else {
            this.openLink(item.recalls);
          }
        }}
      />
    );
  }

  render() {
    return (
      <>
        <StatusBar barStyle="light-content" />
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.header}>
            <Text style={styles.headerText}>
              Mark Book
            </Text>
            {this.state.profile != null && (this.state.editing ?
              <View style={styles.buttons}>
                <TouchableHighlight style={styles.button} underlayColor="#118fe4" onPress={this.deleteEditing} disabled={this.state.loadingBookmarks}>
                  <Text style={styles.buttonLabel}>Delete</Text>
                </TouchableHighlight>
                <TouchableHighlight style={styles.button} underlayColor="#118fe4" onPress={this.cancelEditing} disabled={this.state.loadingBookmarks}>
                  <Text style={styles.buttonLabel}>Cancel</Text>
                </TouchableHighlight>
              </View>
            :
              <View style={styles.buttons}>
                <TouchableHighlight style={styles.button} underlayColor="#118fe4" onPress={this.toggleNewBookmarkModal} disabled={this.state.loadingBookmarks}>
                  <Text style={styles.buttonLabel}>Add</Text>
                </TouchableHighlight>
                <TouchableHighlight style={styles.button} underlayColor="#118fe4" onPress={this.startEditing} disabled={this.state.loadingBookmarks}>
                  <Text style={styles.buttonLabel}>Edit</Text>
                </TouchableHighlight>
              </View>
            )}
          </View>
          <Modal
            isVisible={this.state.addModal}
            onBackdropPress={this.toggleNewBookmarkModal}
            onBackButtonPress={this.toggleNewBookmarkModal}
            avoidKeyboard={true}
          >
            <View style={styles.addModal}>
              <Text style={styles.modalTitle}>Create a bookmark</Text>
              <TextInput
                style={styles.input}
                onChangeText={text => this.setState({ newBookmarkTitle: text })}
                value={this.state.newBookmarkTitle}
                placeholder={'Title'}
              />
              <TextInput
                style={styles.input}
                onChangeText={text => this.setState({ newBookmarkUri: text })}
                value={this.state.newBookmarkUri}
                placeholder={'Uri'}
              />
              <View style={styles.modalButtons}>
                <TouchableHighlight
                  style={[styles.modalButton, {
                    backgroundColor: this.state.newBookmarkTitle.length === 0 || this.state.newBookmarkUri.length === 0 ? 'gray' : '#23d160'
                  }]}
                  underlayColor="#22c65b"
                  onPress={this.createBookmark}
                  disabled={this.state.newBookmarkTitle.length === 0 || this.state.newBookmarkUri.length === 0}
                >
                  <Text style={styles.modalSaveLabel}>Save</Text>
                </TouchableHighlight>
                <TouchableHighlight
                  style={styles.modalButton}
                  underlayColor="#DDDDDD"
                  onPress={this.toggleNewBookmarkModal}
                >
                  <Text style={styles.modalCancelLabel}>Cancel</Text>
                </TouchableHighlight>
              </View>
            </View>
          </Modal>
          {
            this.state.profile == null ?
              <View style={styles.notSignedIn}>
                <Button color="#209cee" title="Sign in with Solid" onPress={logIn} />
              </View>
            :
              <FlatList
                data={this.state.bookmarks}
                renderItem={this.renderBookmark}
                keyExtractor={item => item.subject}
                refreshControl={
                  <RefreshControl
                    refreshing={this.state.loadingBookmarks}
                    onRefresh={this.refreshBookmarks}
                  />
                }
                ListHeaderComponent={
                  <View style={styles.signedIn}>
                    <Text style={styles.title}>
                      {this.state.profile.name}
                    </Text>
                    <Text style={styles.webId}>
                      {this.state.profile.webId}
                    </Text>
                    <Button color="#209cee" title="Sign out" onPress={logOut} />
                  </View>
                }
                ListEmptyComponent={
                  <Text style={styles.noBookmarks} onPress={this.toggleNewBookmarkModal}>
                      Add a bookmark
                  </Text>
                }
              />
          }
        </SafeAreaView>
      </>
    );
  }
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#209cee',
    height: 50,
    paddingLeft: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    color: 'white',
    fontSize: 24,
  },
  buttons: {
    alignSelf: 'stretch',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignContent: 'stretch',
  },
  button: {
    paddingLeft: 15,
    paddingRight: 15,
  },
  buttonLabel: {
    height: '100%',
    textAlignVertical: 'center',
    color: '#EEEEEE',
  },
  notSignedIn: {
    flex: 1,
    justifyContent: 'center',
    margin: 15,
  },
  signedIn: {
    margin: 15,
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
  },
  webId: {
    textAlign: 'center',
    marginBottom: 5,
  },
  noBookmarks: {
    textAlign: 'center',
    textDecorationLine: 'underline',
    margin: 10,
  },
  addModal: {
    padding: 15,
    backgroundColor: 'white',
  },
  modalTitle: {
    fontSize: 18,
    margin: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#8B8B8B',
    margin: 5,
  },
  modalButtons: {
    flexDirection: 'row',
    height: 50,
    width: '100%',
  },
  modalButton: {
    height: 30,
    width: 70,
    margin: 10,
    borderColor: '#dbdbdb',
  },
  modalCancelLabel: {
    height: '100%',
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#363636',
  },
  modalSaveLabel: {
    height: '100%',
    textAlign: 'center',
    textAlignVertical: 'center',
    color: 'white',
  },
});
