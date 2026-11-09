import type { sightingsMessagesEs } from './es'

/** Texts of pet sightings. */
export const sightingsMessagesEn: Record<keyof typeof sightingsMessagesEs, string> = {
    sightings_title: 'Sightings',
    sightings_hint: 'People who think they saw this animal. They are leads, not certainties: check before you travel.',
    sightings_empty: 'Nobody has shared a sighting yet.',
    sightings_load_error: 'We could not load the sightings.',
    sightings_owner_hint: 'If you recognise your pet in a sighting, confirm it: it helps others know where to look.',
    sighting_add: 'I saw it',
    sighting_login: 'Sign in to share a sighting',
    sighting_description_label: 'What did you see?',
    sighting_description_placeholder: 'How it looked, where it was heading, whether it wore a collar…',
    sighting_area_label: 'Area',
    sighting_area_hint: 'A street, a park or a neighbourhood. Never an exact address.',
    sighting_seen_at_label: 'When',
    sighting_photos_label: 'Photos (optional, up to {max})',
    sighting_photo_preview_alt: 'Sighting photo {n}',
    sighting_photo_remove: 'Remove photo {n}',
    sighting_photo_alt: 'Photo {n} of the sighting in {area}',
    sighting_form_privacy:
        'Your first name is shown next to the sighting. Do not include phone numbers, links or personal data: sightings with contact details are reviewed before they are shown.',
    sighting_submit: 'Post sighting',
    sighting_cancel: 'Cancel',
    sighting_published: 'Thank you. Your sighting is now public.',
    sighting_sent_to_review:
        'Thank you. We will review your sighting before showing it; until then only you can see it.',
    sighting_pending: 'Pending review',
    sighting_verified_owner: 'Confirmed by whoever posted the notice',
    sighting_verified_community: 'Backed by the community',
    sighting_progress: '{points} of {threshold} confirmations',
    sighting_author_deleted: 'Deleted user',
    sighting_validate: 'I saw it too',
    sighting_validate_owner: 'It is my pet',
    sighting_validated: 'You backed it',
    sighting_validate_error: 'We could not record your confirmation. Please try again.',
    sighting_delete: 'Delete',
    sighting_hide: 'Hide from my notice',
    sighting_hide_confirm: 'Hide this sighting? We will review it and it will not be shown meanwhile.',
    sighting_hide_error: 'We could not hide the sighting.',
    sightings_scam_warning:
        'Never pay or share bank details to get a pet back. Be wary of anyone who asks for money or contacts you elsewhere.',
    sighting_delete_confirm: 'Delete this sighting? This cannot be undone.',
    sighting_delete_error: 'We could not delete the sighting.',
    sighting_error_rejected: 'This text does not look like a sighting of this animal.',
    sighting_error_rate_limited: 'You did many things in a row. Please try again later.',
    sighting_error_validation:
        'Check the details: a description of at least 10 characters, an area and a date not in the future.',
    sighting_error_unauthorized: 'Your session expired. Please sign in again.',
    sighting_error_closed: 'This notice is already closed.',
    sighting_error_generic: 'We could not post the sighting. Please try again.'
}
