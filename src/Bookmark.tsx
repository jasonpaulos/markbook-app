import React, { FunctionComponent } from 'react';
import {
  TouchableHighlight,
  Text,
  View,
  Image,
  StyleSheet
} from 'react-native';
import moment from 'moment';

export interface Bookmark {
  subject: string,
  recalls: string,
  created: string,
  title: string,
  selected: boolean,
}

export interface BookmarkProps {
  creator: string,
  bookmark: Bookmark,
  editing: boolean,
  onPress: () => any,
}

export const BookmarkComponent: FunctionComponent<BookmarkProps> = ({
  creator, bookmark, editing, onPress
}) => {
  const from = moment(bookmark.created).fromNow();

  return (
    <TouchableHighlight style={styles.button} underlayColor="#DDDDDD" onPress={onPress}>
      <View style={styles.container}>
        <Image
          style={styles.image}
          source={require('../images/markbook.png')}
        />
        <View style={styles.content}>
          <Text numberOfLines={1} ellipsizeMode="middle">
            <Text style={styles.creator}>{creator}</Text> <Text style={styles.when}>{from}</Text>
          </Text>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">{bookmark.title}</Text>
          <Text style={styles.link} numberOfLines={1} ellipsizeMode="tail">{bookmark.recalls}</Text>
        </View>
        { editing && <View style={styles.selection}>
          { bookmark.selected && <Text style={styles.check}>{'\u2713'}</Text> }
        </View> }
      </View>
    </TouchableHighlight>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingLeft: 15,
    paddingRight: 15,
    borderBottomWidth: 1,
    borderColor: '#DDDDDD',
    height: 100,
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  image: {
    width: 70,
    height: 70,
  },
  content: {
    paddingLeft: 15,
    flex: 1,
  },
  creator: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#363636',
  },
  when: {
    fontSize: 12,
    color: 'gray',
  },
  title: {
    fontSize: 16,
    color: '#3273dc',
  },
  link: {
    fontSize: 12,
  },
  selection: {
    width: 25,
    height: 25,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#8B8B8B',
    backgroundColor: '#EEEEEE',
    marginLeft: 5,
    alignItems: 'center',
    overflow: 'visible',
  },
  check: {
    fontSize: 16,
    color: '#363636',
  },
});
