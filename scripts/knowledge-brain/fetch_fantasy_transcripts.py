#!/usr/bin/env python3
"""
Fantasy Football Knowledge Brain Transcript Fetcher
---------------------------------------------------

Local-only companion script for discovering YouTube videos and saving
transcripts as Markdown files that can be imported into the app.

This script is intentionally NOT part of the Next.js server runtime.
Run it from your own computer, not from cloud notebooks, serverless
functions, hosted apps, or production servers.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from datetime import timedelta
from pathlib import Path
from typing import Any

try:
    from youtube_transcript_api import YouTubeTranscriptApi
except ImportError:
    sys.exit(
        "Missing dependency. Run: python -m pip install -r scripts/knowledge-brain/requirements.txt"
    )


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = SCRIPT_DIR / "fantasy_sources.json"
DEFAULT_OUTPUT_DIR = SCRIPT_DIR / "transcripts"
DEFAULT_FAILURE_LOG = SCRIPT_DIR / "failed_videos.jsonl"
DEFAULT_LANG_PREFS = ["en", "en-US", "en-GB"]
MAX_EXPERT_DIR_LENGTH = 36
MAX_TITLE_FILENAME_LENGTH = 48
MAX_WINDOWS_PATH_LENGTH = 240
WINDOWS_RESERVED_NAMES = {
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch fantasy football expert transcripts locally."
    )
    parser.add_argument(
        "--config",
        default=str(DEFAULT_CONFIG_PATH),
        help="Path to fantasy_sources.json.",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Override transcript output directory.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Discover videos and print what would be fetched without saving transcripts.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Process at most N discovered videos after skipping saved videos.",
    )
    parser.add_argument(
        "--sleep-min",
        type=float,
        default=None,
        help="Minimum seconds to pause between transcript requests.",
    )
    parser.add_argument(
        "--sleep-max",
        type=float,
        default=None,
        help="Maximum seconds to pause between transcript requests.",
    )
    parser.add_argument(
        "--continue-on-blocked",
        action="store_true",
        help="Keep trying videos after IpBlocked/RequestBlocked. Default is to stop early.",
    )
    return parser.parse_args()


def load_config(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")

    with path.open("r", encoding="utf-8") as config_file:
        return json.load(config_file)


def discover_videos(config: dict[str, Any]) -> list[dict[str, Any]]:
    videos_by_id: dict[str, dict[str, Any]] = {}
    defaults = config.get("defaults", {})
    max_results_per_search = int(defaults.get("max_results_per_search", 5))
    max_results_per_channel = int(defaults.get("max_results_per_channel", 10))
    min_duration_seconds = int(defaults.get("min_duration_seconds", 0))
    show_filter_reasons = bool(defaults.get("_show_filter_reasons", False))

    for source in config.get("sources", []):
        if not source.get("enabled", True):
            continue

        expert_name = source.get("name", "Unknown Expert")
        search_terms = source.get("search_terms", [])
        channel_urls = [
            url
            for url in source.get("channel_urls", [])
            if url and not str(url).startswith("TODO")
        ]

        for search_term in search_terms:
            target = f"ytsearch{max_results_per_search}:{search_term}"
            for video in list_videos_with_ytdlp(target, min_duration_seconds):
                add_video_if_allowed(
                    videos_by_id,
                    video,
                    expert_name,
                    source,
                    defaults,
                    show_filter_reasons,
                )

        for channel_url in channel_urls:
            extra_args = ["--playlist-end", str(max_results_per_channel)]
            for video in list_videos_with_ytdlp(
                channel_url,
                min_duration_seconds,
                extra_args=extra_args,
            ):
                add_video_if_allowed(
                    videos_by_id,
                    video,
                    expert_name,
                    source,
                    defaults,
                    show_filter_reasons,
                )

    return list(videos_by_id.values())


def add_video_if_allowed(
    videos_by_id: dict[str, dict[str, Any]],
    video: dict[str, Any],
    expert_name: str,
    source: dict[str, Any],
    defaults: dict[str, Any],
    show_filter_reasons: bool,
) -> None:
    allowed, reason = evaluate_video_filters(video, source, defaults)
    title = video.get("title") or video.get("id") or "Untitled video"

    if show_filter_reasons:
        status = "INCLUDED" if allowed else "EXCLUDED"
        print(f"{status}: {expert_name} | {title[:90]} | {reason}")

    if allowed:
        add_video(videos_by_id, video, expert_name)


def evaluate_video_filters(
    video: dict[str, Any],
    source: dict[str, Any],
    defaults: dict[str, Any],
) -> tuple[bool, str]:
    searchable_text = normalize_search_text(
        " ".join(
            str(part or "")
            for part in [
                video.get("title"),
                video.get("description"),
                video.get("channel"),
                video.get("uploader"),
            ]
        )
    )
    include_terms = get_config_list(source, defaults, "include_search_terms")
    exclude_terms = get_config_list(source, defaults, "exclude_search_terms")
    min_upload_date = parse_config_date(
        source.get("min_upload_date") or defaults.get("min_upload_date")
    )
    max_age_days = source.get("max_age_days", defaults.get("max_age_days"))
    upload_date = parse_video_upload_date(video.get("upload_date"))

    if min_upload_date and (not upload_date or upload_date < min_upload_date):
        return False, f"upload date {format_filter_date(upload_date)} is before {min_upload_date.isoformat()}"

    if max_age_days is not None and upload_date:
        cutoff = datetime.now(timezone.utc).date() - timedelta(days=int(max_age_days))

        if upload_date < cutoff:
            return False, f"upload date {upload_date.isoformat()} is older than max_age_days {max_age_days}"

    for term in exclude_terms:
        if normalize_search_text(term) in searchable_text:
            return False, f"matched exclude term '{term}'"

    if include_terms and not any(
        normalize_search_text(term) in searchable_text for term in include_terms
    ):
        return False, f"missing include terms: {', '.join(include_terms)}"

    return True, "matched freshness/search filters"


def get_config_list(
    source: dict[str, Any],
    defaults: dict[str, Any],
    key: str,
) -> list[str]:
    values = source.get(key, defaults.get(key, []))

    if not isinstance(values, list):
        return []

    return [str(value).strip() for value in values if str(value).strip()]


def parse_config_date(value: Any):
    if not value:
        return None

    text = str(value).strip()

    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return None

    return datetime.strptime(text, "%Y-%m-%d").date()


def parse_video_upload_date(value: Any):
    text = str(value or "").strip()

    if re.fullmatch(r"\d{8}", text):
        return datetime.strptime(text, "%Y%m%d").date()

    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return datetime.strptime(text, "%Y-%m-%d").date()

    return None


def format_filter_date(value: Any) -> str:
    return value.isoformat() if value else "unknown"


def normalize_search_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.lower()).strip()


def list_videos_with_ytdlp(
    target: str,
    min_duration_seconds: int,
    extra_args: list[str] | None = None,
) -> list[dict[str, Any]]:
    command = [
        sys.executable,
        "-m",
        "yt_dlp",
        "--dump-json",
        "--skip-download",
        "--no-warnings",
    ]

    if min_duration_seconds > 0:
        command.extend(["--match-filter", f"duration >= {min_duration_seconds}"])

    if extra_args:
        command.extend(extra_args)

    command.append(target)
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=180,
        encoding="utf-8",
        errors="replace",
    )

    if result.returncode != 0:
        print(f"yt-dlp failed for {target}: {result.stderr.strip()[:300]}")
        return []

    videos = []
    for line in result.stdout.splitlines():
        if not line.strip():
            continue

        try:
            videos.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    return videos


def add_video(
    videos_by_id: dict[str, dict[str, Any]],
    video: dict[str, Any],
    expert_name: str,
) -> None:
    video_id = video.get("id") or extract_video_id(video.get("webpage_url", ""))

    if not video_id:
        return

    existing = videos_by_id.get(video_id, {})
    experts = set(existing.get("experts", []))
    experts.add(expert_name)

    video["experts"] = sorted(experts)
    videos_by_id[video_id] = {**existing, **video}


def extract_video_id(url: str) -> str | None:
    patterns = [
        r"(?:v=|/v/|youtu\.be/|/shorts/|/live/|/embed/)([A-Za-z0-9_-]{11})",
        r"^([A-Za-z0-9_-]{11})$",
    ]

    for pattern in patterns:
        match = re.search(pattern, url.strip())
        if match:
            return match.group(1)

    return None


def already_saved(output_dir: Path, video_id: str) -> bool:
    return any(output_dir.rglob(f"*{video_id}*.md"))


def fetch_transcript(video_id: str, languages: list[str]) -> str:
    api = YouTubeTranscriptApi()
    fetched = api.fetch(video_id, languages=languages)
    text_segments = [
        snippet.text.strip()
        for snippet in fetched
        if getattr(snippet, "text", "").strip()
    ]
    text = " ".join(text_segments)
    text = re.sub(r"\s+", " ", text)

    return paragraphize(text)


def paragraphize(text: str, target_words: int = 120) -> str:
    words = text.split(" ")
    paragraphs: list[str] = []
    current: list[str] = []

    for word in words:
        current.append(word)
        if len(current) >= target_words and word.endswith((".", "?", "!")):
            paragraphs.append(" ".join(current))
            current = []

    if current:
        paragraphs.append(" ".join(current))

    return "\n\n".join(paragraphs)


def save_markdown_transcript(
    video: dict[str, Any],
    transcript: str,
    output_dir: Path,
) -> Path:
    video_id = video["id"]
    expert_name = get_expert_name(video)
    title = video.get("title") or f"YouTube video {video_id}"
    channel = video.get("channel") or video.get("uploader") or "Unknown Channel"
    upload_date = normalize_upload_date(video.get("upload_date"))
    duration_seconds = int(video.get("duration") or 0)
    runtime = format_runtime(duration_seconds)
    url = video.get("webpage_url") or f"https://www.youtube.com/watch?v={video_id}"
    path = build_transcript_path(
        output_dir=output_dir,
        expert_name=expert_name,
        upload_date=upload_date,
        title=title,
        video_id=video_id,
    )
    header = {
        "expert": expert_name,
        "channel": channel,
        "title": title,
        "date": upload_date,
        "content_season": get_content_season(upload_date),
        "runtime": runtime,
        "runtime_seconds": duration_seconds,
        "url": url,
        "video_id": video_id,
        "source_platform": "YouTube",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }

    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("x", encoding="utf-8") as transcript_file:
        transcript_file.write(format_front_matter(header))
        transcript_file.write(f"# {title}\n\n")
        transcript_file.write(transcript.strip())
        transcript_file.write("\n")

    return path


def get_content_season(upload_date: str) -> str:
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", upload_date):
        return upload_date[:4]

    return "unknown"


def build_transcript_path(
    output_dir: Path,
    expert_name: str,
    upload_date: str,
    title: str,
    video_id: str,
) -> Path:
    expert_dir = output_dir / safe_filename(
        expert_name,
        max_len=MAX_EXPERT_DIR_LENGTH,
    )
    title_part = safe_filename(title, max_len=MAX_TITLE_FILENAME_LENGTH)
    filename = f"{upload_date}_{title_part}_{video_id}.md"
    path = expert_dir / filename

    if len(str(path.resolve())) <= MAX_WINDOWS_PATH_LENGTH:
        return path

    short_title = safe_filename(title, max_len=24)
    filename = f"{upload_date}_{short_title}_{video_id}.md"
    path = expert_dir / filename

    if len(str(path.resolve())) <= MAX_WINDOWS_PATH_LENGTH:
        return path

    return output_dir / f"{upload_date}_{video_id}.md"


def format_front_matter(metadata: dict[str, Any]) -> str:
    lines = ["---"]

    for key, value in metadata.items():
        if isinstance(value, int):
            lines.append(f"{key}: {value}")
        else:
            lines.append(f"{key}: {json.dumps(str(value), ensure_ascii=False)}")

    lines.append("---")
    lines.append("")

    return "\n".join(lines)


def get_expert_name(video: dict[str, Any]) -> str:
    experts = video.get("experts") or []

    return experts[0] if experts else "Unknown Expert"


def normalize_upload_date(value: Any) -> str:
    text = str(value or "").strip()

    if re.fullmatch(r"\d{8}", text):
        return f"{text[:4]}-{text[4:6]}-{text[6:]}"

    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return text

    return "unknown-date"


def format_runtime(seconds: int) -> str:
    if seconds <= 0:
        return "unknown"

    hours, remainder = divmod(seconds, 3600)
    minutes, remaining_seconds = divmod(remainder, 60)

    if hours:
        return f"{hours}:{minutes:02d}:{remaining_seconds:02d}"

    return f"{minutes}:{remaining_seconds:02d}"


def safe_filename(value: str, max_len: int = 90) -> str:
    safe = str(value or "").strip()
    safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", safe)
    safe = re.sub(r"[^\w\s.-]", "", safe, flags=re.ASCII)
    safe = re.sub(r"\s+", "_", safe)
    safe = safe.strip(" ._-")
    safe = safe[:max_len].strip(" ._-")

    if not safe:
        return "untitled"

    if safe.upper() in WINDOWS_RESERVED_NAMES:
        return f"{safe}_file"

    return safe


def log_failure(path: Path, video: dict[str, Any], error: Exception) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    video_id = video.get("id") or extract_video_id(video.get("webpage_url", ""))
    failure_record = {
        "expertSource": get_expert_name(video),
        "title": video.get("title"),
        "url": video.get("webpage_url"),
        "videoId": video_id,
        "errorType": type(error).__name__,
        "errorMessage": str(error),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    with path.open("a", encoding="utf-8") as failure_log:
        failure_log.write(json.dumps(failure_record, ensure_ascii=False) + "\n")


def is_blocked_error(error: Exception) -> bool:
    error_type = type(error).__name__.lower()
    error_message = str(error).lower()

    return (
        "ipblocked" in error_type
        or "requestblocked" in error_type
        or "ip blocked" in error_message
        or "request blocked" in error_message
        or "blocked" in error_message
    )


def print_blocked_message() -> None:
    print("\nYouTube transcript requests appear to be blocked right now.")
    print("Stopping early so the script does not burn through every remaining video.")
    print("Wait a while before retrying, then resume with a small --limit and longer sleeps.")


def main() -> None:
    args = parse_args()
    config_path = Path(args.config).resolve()
    config = load_config(config_path)
    defaults = config.get("defaults", {})
    defaults["_show_filter_reasons"] = args.dry_run
    output_dir = Path(args.output_dir or defaults.get("output_dir") or DEFAULT_OUTPUT_DIR)
    output_dir = output_dir if output_dir.is_absolute() else (config_path.parent / output_dir)
    failure_log = Path(defaults.get("failure_log") or DEFAULT_FAILURE_LOG)
    failure_log = failure_log if failure_log.is_absolute() else (config_path.parent / failure_log)
    default_sleep_min, default_sleep_max = defaults.get("sleep_seconds", [6, 12])
    sleep_min = args.sleep_min if args.sleep_min is not None else default_sleep_min
    sleep_max = args.sleep_max if args.sleep_max is not None else default_sleep_max

    if sleep_min < 0 or sleep_max < 0:
        raise ValueError("--sleep-min and --sleep-max must be zero or greater.")

    if sleep_max < sleep_min:
        raise ValueError("--sleep-max must be greater than or equal to --sleep-min.")

    languages = defaults.get("languages", DEFAULT_LANG_PREFS)
    videos = discover_videos(config)

    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Discovered {len(videos)} unique videos.")
    print(f"Output directory: {output_dir.resolve()}")
    print(f"Sleep window: {sleep_min} to {sleep_max} seconds.")

    if args.dry_run:
        dry_run_videos = videos[: args.limit] if args.limit else videos

        for video in dry_run_videos:
            print(
                f"DRY RUN: {get_expert_name(video)} | {normalize_upload_date(video.get('upload_date'))} | {video.get('title')} | {video.get('webpage_url')}"
            )
        return

    saved = 0
    skipped = 0
    failed = 0

    processed = 0
    stopped_for_block = False

    for index, video in enumerate(videos, start=1):
        video_id = video.get("id")

        if not video_id:
            continue

        if already_saved(output_dir, video_id):
            skipped += 1
            print(f"[{index}/{len(videos)}] Already saved {video_id}; skipping.")
            continue

        if args.limit is not None and processed >= args.limit:
            print(f"Reached --limit {args.limit}; stopping.")
            break

        processed += 1
        title = video.get("title") or video_id
        print(f"[{index}/{len(videos)}] Fetching transcript: {title[:80]}")

        try:
            transcript = fetch_transcript(video_id, languages)
            path = save_markdown_transcript(video, transcript, output_dir)
            saved += 1
            print(f"    Saved {path}")
        except Exception as error:
            failed += 1
            print(f"    FAILED {type(error).__name__}: {error}")
            log_failure(failure_log, video, error)

            if is_blocked_error(error) and not args.continue_on_blocked:
                stopped_for_block = True
                print_blocked_message()
                break

        if index < len(videos) and not stopped_for_block:
            time.sleep(random.uniform(float(sleep_min), float(sleep_max)))

    print(
        f"\nDone. {saved} saved, {skipped} skipped, {failed} failed. Failures log: {failure_log.resolve()}"
    )

    if stopped_for_block:
        print("Stopped early because transcript requests were blocked.")


if __name__ == "__main__":
    main()
