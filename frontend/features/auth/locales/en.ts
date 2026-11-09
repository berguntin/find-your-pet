import type { authMessagesEs } from './es'

/** Texts of sign-in and the user account. */
export const authMessagesEn: Record<keyof typeof authMessagesEs, string> = {
    auth_login: 'Sign in',
    auth_login_google: 'Sign in with Google',
    auth_logout: 'Sign out',
    auth_cancel: 'Cancel',
    auth_account_menu: "{name}'s account",
    auth_avatar_alt: "{name}'s profile picture",
    auth_signed_in_as: 'Hi, {name}',
    auth_admin_panel: 'Admin panel',
    auth_delete_account: 'Delete my account',
    auth_delete_account_title: 'Delete your account?',
    auth_delete_account_body:
        'We will delete your account. Unless you tick the box, notices you posted stay visible, but you will no longer be able to manage them. This cannot be undone.',
    auth_delete_account_pets: 'Also delete all my notices and their photos',
    auth_delete_account_confirm: 'Delete account',
    auth_delete_account_error: 'We could not delete the account. Please try again.',
    auth_page_title: 'Sign in',
    auth_page_intro: 'Sign in with your Google account to manage the notices you post.',
    auth_page_privacy: 'We only keep your first name and your Google account id. We do not store your email.',
    auth_error_oauth: 'We could not complete the sign-in. Please try again.',
    auth_error_unverified: 'Your Google account email is not verified.',
    auth_report_hint: 'If you sign in with Google, you can mark this notice as resolved or delete it later.'
}
