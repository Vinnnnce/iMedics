# Emergency education provenance

Video titles, publishers, thumbnails and embedding availability were freshly checked against YouTube oEmbed on 30 October 2026. These are public educational resources, not a substitute for certified training or professional care.

## Verified videos

| Topic | Exact publisher title and URL | Publisher |
| --- | --- | --- |
| Basic first aid | [How to do the Primary Survey - First Aid Training - St John Ambulance](https://www.youtube.com/watch?v=ea1RJUOiNfQ) | St John Ambulance |
| Adult CPR and AED | [Hands-Only CPR Plus AED – Man (International English)](https://www.youtube.com/watch?v=_l1g3aWd_BQ) | American Heart Association |
| Stroke | [What To Do If Someone Has A Stroke, Signs & Symptoms - First Aid Training - St John Ambulance](https://www.youtube.com/watch?v=PhH9a0kIwmk) | St John Ambulance |
| Heart attack | [First aid for someone having a heart attack \| First aid training online \| British Red Cross](https://www.youtube.com/watch?v=vYWFVebej5A) | British Red Cross |
| Bleeding | [First Aid Training: Life-threatening bleeding](https://www.youtube.com/watch?v=p9KHec6xfuw) | St John Ambulance |
| Infant choking | [What to do if Your Baby is Choking - First Aid Training - St John Ambulance](https://www.youtube.com/watch?v=oswDpwzbAV8) | St John Ambulance |
| Burns | [Burns and Scalds - Animated](https://www.youtube.com/watch?v=TLr2qsEhpC8) | St John Ambulance |
| Waiting for assistance | [First aid for someone who is unresponsive but breathing \| First aid training \| British Red Cross](https://www.youtube.com/watch?v=5fK2oCiz8VU) | British Red Cross |

The last video concerns a specific situation while waiting for help, not all ambulance emergencies. The choking video is explicitly infant-specific, not an adult technique demonstration. Publishers may use UK emergency numbers; the UI instructs users to use their own local emergency services.

## Illustration assets

All nine guide illustrations render as local inline SVG, extending `src/components/emergency/illustrations.tsx`. The first-aid assessment and CPR illustrations reuse the existing project set; the seven other recognition/equipment symbols are original schematic additions in its line-art style.

No third-party illustration files, expiring image services, downloaded YouTube media or stock images were copied. These are non-graphic memory aids, not professionally clinically reviewed anatomical or procedural illustrations. An unknown illustration key uses the project's clean default silhouette rather than a broken image.

## Written guidance

In addition to the publisher videos above, the written cards reference [St John Ambulance first-aid advice](https://www.sja.org.uk/first-aid-advice/), [choking guidance](https://www.sja.org.uk/first-aid-advice/choking/), [traffic collision guidance](https://www.sja.org.uk/first-aid-advice/traffic-collision/) and [burns and scalds guidance](https://www.sja.org.uk/first-aid-advice/burns-and-scalds/). Existing BLS/ALS course content and its source statements remain unchanged except for the common safety notice.

## Media behavior

Thumbnails use YouTube's supported `i.ytimg.com/vi/<id>/hqdefault.jpg` endpoint, lazy loading and an error fallback. No iframe loads until the user activates Load video, and Close player removes it. Players use `youtube-nocookie.com/embed/<id>`, a responsive 16:9 wrapper, strict-origin referrer policy and caption request `cc_load_policy=1`.

Every video has a permanent external Watch on YouTube link, including when embeds are blocked or unavailable. Cross-origin player errors cannot be reliably inspected from the parent, so fallback advice remains visible rather than claiming that a timer or iframe load proves playback. Publisher caption availability and future video availability are not guaranteed.
