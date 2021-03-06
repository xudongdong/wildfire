<template>
  <i-form :model="form"
    :label-width="60"
    class="wf-reply-form"
    :class="{ 'wf-is-reply': isReply }">
    <i-form-item class="no-bottom-margin">
      <img slot="label" :src="avatarURL" :class="{ anonymous: user === null }">
      <i-input
        v-model="form.content"
        type="textarea"
        @on-focus="contentOnFocus"
        @on-change="contentOnChange"
        :autosize="{ minRows: 3, maxRows: 10 }"
        :placeholder="placeholder"
        :disabled="shouldDisableInput"></i-input>
    </i-form-item>
    <section class="top-reply-area" v-if="isMain">
      <div class="tool-bar">
        <span style="color: #bbbec4">
          {{mentionLabel}}
        </span>
      </div>
      <div>
        <i-button type="text"
          class="wf-clear-btn"
          :disabled="shouldDisableButton"
          @click="form.content = ''">
          {{$i18next.t('ReplyArea.btn.clear')}}
        </i-button>

        <i-button :type="isPosting ? 'ghost' : 'primary'"
          class="wf-post-btn"
          style="margin-left: 8px"
          @click="postComment"
          :disabled="shouldDisableButton"
          :loading="isPosting">
          {{$i18next.t(isPosting ? 'ReplyArea.btn.posting' : 'ReplyArea.btn.post')}}
        </i-button>
      </div>
    </section>

    <i-form-item class="float-right" v-else>
      <i-button type="text"
        :disabled="shouldDisableButton"
        @click="form.content = ''">
        {{$i18next.t('ReplyArea.btn.clear')}}
      </i-button>

      <i-button :type="isPosting ? 'ghost' : 'primary'"
        style="margin-left: 8px"
        @click="postComment"
        :disabled="shouldDisableButton"
        :loading="isPosting">
        {{$i18next.t(isPosting ? 'ReplyArea.btn.posting' : 'ReplyArea.btn.post')}}
      </i-button>
    </i-form-item>
  </i-form>
</template>

<script>
import Bus from '../common/bus'
export default {
  name: 'wf-reply-area',
  props: [
    'user',
    'replyToCommentAuthorUsername',
    'replyToComment',
    'rootComment',
    'commentsLoadingState',
    'pageCommentsCount',
    'rootCommentRepliesCount',
    'isMain'
  ],
  data () {
    return {
      isPosting: false,
      form: {
        content: ''
      },
      users: [],
      /*
        Mention
       */
      mentioningUsername: '',
      atPosition: null,
      shouldShowAutoComplete: false
      /*
        End of: Mention
       */
    }
  },
  computed: {
    $config () {
      return this.$_wf.config
    },
    $db () {
      return this.$_wf.db
    },
    $info () {
      return this.$_wf.info
    },
    $i18next () {
      return this.$_wf.i18next
    },
    avatarURL () {
      return this.user
        ? this.user.photoURL
        : this.$config.defaultAvatarURL
    },
    username () {
      return this.user
              ? this.$i18next.t('common.anonymous_user')
              : this.user.displayName
    },
    placeholder () {
      return this.isCurrentUserBanned
      ? this.$i18next.t('ReplyArea.placeholder.user_is_banned')
      : this.isReply
        ? this.$i18next.t('ReplyArea.placeholder.reply_to_user_comment', { username: this.replyToCommentAuthorUsername })
        : (this.user
            ? this.$i18next.t('ReplyArea.placeholder.join_conversation')
            : this.$i18next.t('ReplyArea.placeholder.join_conversation_anonymously'))
    },
    isReply () {
      return !!this.replyToComment
    },
    shouldDisableInput () {
      return this.isPosting || this.commentsLoadingState === 'loading' || this.isCurrentUserBanned
    },
    shouldDisableButton () {
      return this.form.content.trim() === '' || this.isPosting || this.isCurrentUserBanned
    },
    isLoadingUserData () {
      return Bus.$data.isLoadingUserData
    },
    isMentionEnabled () {
      return !this.isLoadingUserData
    },
    isCurrentUserBanned () {
      return (this.user && this.user.isBanned) || (!this.user && this.$info.isBanned)
    },
    mentionLabel () {
      return this.isLoadingUserData
              ? this.$i18next.t('ReplyArea.text.initializing_mention_autocomplete')
              : (this.user
                  ? this.$i18next.t('ReplyArea.text.initialized_mention_autocomplete')
                  : this.$i18next.t('ReplyArea.text.mention_func_not_authorized'))
    }
  },
  mounted () {
    /*
      `MentionAutoCompleteSelected` event observer
      Note: update current reply area when recieves the event.
     */
    Bus.$on(`MentionAutoCompleteSelected-${this._uid}`, formattedMentionText => {
      const content = this.form.content
      // replace the '@' symbol with formatted text
      this.form.content = [content.slice(0, this.atPosition - 1), formattedMentionText, content.slice(this.atPosition)].join('')
    })
  },
  beforeDestroy () {
    Bus.enough('OnlyOneReplyAreaShouldBeActive', null, this._uid)
    Bus.enough(`MentionAutoCompleteSelected-${this._uid}`)
  },
  methods: {
    isAnonymousUser (uid) {
      const { anonymousUserId } = this.$config
      return !uid || uid === anonymousUserId
    },
    postComment () {
      if (this.isPosting) { return }

      // If user manage to activate the reply area,
      // and try to post new comment :-D
      if (this.isCurrentUserBanned) {
        this.$Modal.error({
          title: this.$i18next.t('ReplyArea.error.banned_title'),
          content: this.$i18next.t('ReplyArea.error.banned_content'),
          okText: this.$i18next.t('ReplyArea.btn.confirm')
        })
        return
      }

      this.isPosting = true
      const { content } = this.form
      const { user, users, isReply, replyToComment } = this

      if (content.trim() !== '') {
        const aDate = new Date()
        const ip = this.$info.ip
        const uid = user ? user.uid : this.$config.anonymousUserId
        const date = aDate.toISOString()

        let pageURL = null
        let rootCommentPageURL = null
        let parentCommentId = null
        let parentCommentUid = null
        let rootCommentId = null
        let rootCommentUid = null

        if (isReply) {
          // The field `pageURL` of a comment is used to determine
          // whether it's a top-level comment or not.
          // As shown in `App.vue`, pageURL` is used as a filter
          // for retrieving comments of a page.
          // If the comment is top-level comment, then it has `pageURL`;
          // else, it has `rootCommentPageURL`.
          rootCommentPageURL = this.$config.pageURL
          parentCommentId = replyToComment.commentId
          parentCommentUid = replyToComment.uid
          if (replyToComment.rootCommentId) {
            rootCommentId = replyToComment.rootCommentId
            rootCommentUid = replyToComment.rootCommentUid
          } else {
            rootCommentId = replyToComment.commentId
            rootCommentUid = replyToComment.uid
          }
        } else {
          pageURL = this.$config.pageURL
        }

        const postData = { uid, content, date, ip, pageURL, rootCommentPageURL, parentCommentId, parentCommentUid, rootCommentId, rootCommentUid }

        var newNode = this.$db.ref().push()
        /*
          There is a difference between `firebase` and `wilddog`
          Note:
            - firebase: ref.key
            - wilddog: ref.key()
         */
        const newKey = this.$config.databaseProvider === 'firebase' ? newNode.key : newNode.key()

        Promise.all([
          this.$db.ref(`comments/${newKey}`).update(postData),
          isReply
            ? this.$db.ref(`commentReplies/${rootCommentId}/${newKey}`).set(date)
            : this.$db.ref(`pages/${pageURL}/comments/${newKey}`).set(date)
        ]).then(() => {
          this.isPosting = false
          this.$emit('finished-replying') // When successfully posted reply, hide current reply area
          this.form.content = ''
          this.$Message.success(this.$i18next.t('ReplyArea.success.posting_comment'))

          /*
            Handle Mention
           */

          const admin = Bus.$data.admin

          let shouldNotifyAdmin = true
          let shouldNotifyParentCommentAuthor = true
          let shouldNotifyRootCommentAuthor = true
          let isAdminMentioned = false
          let isParentCommentAuthorMentioned = false
          let isRootCommentAuthorMentioned = false
          // If current user is admin,
          // then no notification to `admin`.
          if (!admin) {
            shouldNotifyAdmin = false
          } if (user && user.uid === admin.uid) {
            shouldNotifyAdmin = false
          }
          // If replying to comment posted by
          //  (1) anonymous user,
          //  (2) self, or
          //  (3) admin,
          // or new comment is top-level comment,
          // then no notification to `parentCommentAuthor`.
          if (!replyToComment || this.isAnonymousUser(replyToComment.uid)) {
            shouldNotifyParentCommentAuthor = false
          } else if (user && user.uid === replyToComment.uid) {
            shouldNotifyParentCommentAuthor = false
          } else if (admin.uid === replyToComment.uid) {
            shouldNotifyParentCommentAuthor = false
          }
          // If `rootComment` posted by
          //  (1) anonymous user,
          //  (2) self, or
          //  (3) admin,
          // or new comment is top-level comment,
          // or `rootCommentAuthor` is `parentCommentAuthor`,
          // then no notification to `rootCommentAuthor`.
          if (!replyToComment || this.isAnonymousUser(replyToComment.rootCommentUid)) {
            shouldNotifyRootCommentAuthor = false
          } else if (user && user.uid === replyToComment.rootCommentUid) {
            shouldNotifyRootCommentAuthor = false
          } else if (admin.uid === replyToComment.rootCommentUid) {
            shouldNotifyRootCommentAuthor = false
          } else if (replyToComment.uid === replyToComment.rootCommentUid) {
            shouldNotifyRootCommentAuthor = false
          }

          const notifyFlags = {
            shouldNotifyAdmin,
            shouldNotifyParentCommentAuthor,
            shouldNotifyRootCommentAuthor
          }
          const mentionFlags = {
            isAdminMentioned,
            isParentCommentAuthorMentioned,
            isRootCommentAuthorMentioned
          }
          // Forbid anonymous user to use Mention
          if (!this.user) {
            this.handleNotifications([], newKey, notifyFlags, mentionFlags)
            return
          }
          const mentions = content.match(new RegExp('\\[@([^\\[\\]]+)\\]\\([^\\(\\)]+\\)', 'g')) || []
          if (users.length !== 0) {
            const mentionedUids = mentions.map(mention => this.users.find(user => user.email === mention.slice(mention.indexOf('(') + 1, -1)).id)
            this.handleNotifications(mentionedUids, newKey, notifyFlags, mentionFlags)
          } else {
            Promise.all(mentions.map(mention => {
              const email = mention.slice(mention.indexOf('(') + 1, -1)
              return this.$db.ref(`users`).orderByChild('email').equalTo(email).once('value')
            })).then(snaps => {
              const mentionedUids = snaps.map(snap => snap.val() ? Object.keys(snap.val())[0] : undefined)
              this.handleNotifications(mentionedUids, newKey, notifyFlags, mentionFlags)
            })
          }
          /*
            End of: Handle Mention
           */
        })
        .catch((error) => {
          this.isPosting = false
          this.form.content = ''
          this.$Message.error(this.$i18next.t('ReplyArea.error.posting_comment'))
          console.log(error)
        })
      }
    },
    handleNotifications (mentionedUids, commentId, notifyFlags, mentionFlags) {
      const user = this.user
      const admin = Bus.$data.admin
      const {
        shouldNotifyAdmin,
        shouldNotifyParentCommentAuthor,
        shouldNotifyRootCommentAuthor
      } = notifyFlags
      let {
        isAdminMentioned,
        isParentCommentAuthorMentioned,
        isRootCommentAuthorMentioned
      } = mentionFlags
      const pageURL = this.$config.pageURL
      mentionedUids.forEach(mentionedUid => {
        // Incase uid is undefined/null
        if (!mentionedUid) { return }

        // If mentioning self, no notification.
        if (mentionedUid === user.uid) { return }
        // If mentioning (1) admin, (2) parentCommentAuthor,
        // or (3) rootCommentAuthor, then set related flag
        // and leave the notification
        if (mentionedUid === admin.uid) {
          isAdminMentioned = true
          return
        }
        if (this.replyToComment && mentionedUid === this.replyToComment.uid) {
          isParentCommentAuthorMentioned = true
          return
        }
        if (this.replyToComment && mentionedUid === this.replyToComment.rootCommentUid) {
          isRootCommentAuthorMentioned = true
          return
        }
        // Post notification to mentioned user
        this.postNotification({
          uid: mentionedUid,
          type: 'm',
          pageURL: pageURL,
          pageTitle: this.$config.pageTitle,
          commentId
        })
      })

      if (shouldNotifyAdmin) {
        this.postNotification({
          uid: admin.uid,
          type: isAdminMentioned
                ? 'm'
                : (this.replyToComment
                    ? (this.replyToComment.uid === admin.uid
                      ? 'r' : 'd')
                    : 'c'),
          pageURL: pageURL,
          pageTitle: this.$config.pageTitle,
          commentId
        })
      }
      if (shouldNotifyParentCommentAuthor) {
        this.postNotification({
          uid: this.replyToComment.uid,
          type: isParentCommentAuthorMentioned ? 'm' : 'r',
          pageURL: pageURL,
          pageTitle: this.$config.pageTitle,
          commentId
        })
      }
      if (shouldNotifyRootCommentAuthor) {
        this.postNotification({
          uid: this.replyToComment.rootCommentUid,
          type: isRootCommentAuthorMentioned ? 'm' : 'd',
          pageURL: pageURL,
          pageTitle: this.$config.pageTitle,
          commentId
        })
      }
    },
    postNotification (data) {
      const aDate = new Date()
      const date = aDate.toISOString()
      const {uid, type, pageURL = null, pageTitle = null, commentId = null, content = null} = data
      this.$db.ref('notifications').push({
        uid,
        type,
        pageURL,
        pageTitle,
        commentId,
        content,
        date,
        isRead: false
      })
    },
    contentOnFocus (e) {
      if (this.isMain) {
        Bus.$emit('OnlyOneReplyAreaShouldBeActive', 'MainReplyArea')
      }
    },
    contentOnChange (e) {
      // Forbid anonymous user to use Mention
      if (!this.user) { return }

      this.shouldShowAutoComplete = true
      if (e.data === '@' && this.isMentionEnabled) {
        this.atPosition = e.target.selectionStart
        Bus.$emit('ShowMentionAutoComplete', this._uid)
      }
    }
  }
}
</script>
