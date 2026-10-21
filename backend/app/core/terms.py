from datetime import datetime, timezone

from app.models.user import User

CURRENT_TERMS_VERSION = "2026-10-21"
CURRENT_TERMS_TITLE = "Anime Tracker Terms"

CURRENT_TERMS_SECTIONS: list[tuple[str, str]] = [
    (
        "Your account",
        "You must provide a real email address and keep your password private. You are responsible for activity under your account.",
    ),
    (
        "Your content",
        "Collections, ratings, and watch sites you add stay associated with your account. Do not add anything you do not have the right to share.",
    ),
    (
        "Other people",
        "Other signed-in users can find your username and avatar, including when your profile is private. They can see your collection or reusable watch sites only when you leave those sharing settings on. A private profile shows only enough to request a follow until you approve it.",
    ),
    (
        "Copied watch sites",
        "Watch sites are links contributed by users. Copying one saves a snapshot of that site’s name, address, and episode or search templates, including {slug}, {title}, and {episode}. Links saved for one specific anime stay on the original account. Anime Tracker does not operate those sites, does not check that they stay safe or available, and the copy warning in the app is not a promise that the service has no legal responsibility. Use them at your own caution.",
    ),
    (
        "The service",
        "Anime Tracker is provided as available. Anime details come from AniList. These terms can be updated; continued use after a new version requires accepting that version.",
    ),
]


def user_accepted_current_terms(user: User) -> bool:
    return user.terms_accepted_version == CURRENT_TERMS_VERSION


def record_terms_acceptance(user: User) -> None:
    user.terms_accepted_version = CURRENT_TERMS_VERSION
    user.terms_accepted_at = datetime.now(timezone.utc)
