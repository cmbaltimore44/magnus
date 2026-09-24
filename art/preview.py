#!/usr/bin/env python3
"""Show every figure in this terminal, in its theme's own colors, two per row."""
from figures import FIGURES

LABELS = {
    'coopers_hawk': "1. Cooper's hawk, perched", 'hawk_flight': "2. Cooper's hawk, in flight",
    'owl': '3. Great horned owl', 'raven': '4. Raven', 'heron': '5. Great blue heron',
    'robin': '6. Robin', 'cardinal': '7. Cardinal', 'hummingbird': '8. Hummingbird',
    'fox': '9. Fox', 'mountain_lake': '10. Mountain lake at sunset',
    'kingfisher': '11. Kingfisher', 'puffin': '12. Puffin', 'blue_jay': '13. Blue jay', 'loon': '14. Loon on a lake',
    'lighthouse': '15. Lighthouse at night', 'moon_pines': '16. Crescent moon over pines', 'journal': '17. Open journal and quill', 'sailboat': '18. Sailboat at dusk',
    'heron_flight': '19. Heron in flight', 'tiger': '20. Tiger', 'lighthouse_cliff': '21. Lighthouse on a cliff', 'coffee': '22. Coffee', 'sleeping_cat': '23. Sleeping cat',
    'chess_knight': '24. Chess knight', 'penguin': '25. Penguin', 'flamingo': '26. Flamingo', 'wolf': '27. Wolf howling at the moon',
    'whale_tail': '28. Whale tail at dusk', 'campfire': '29. Campfire and tent', 'balloon': '30. Hot air balloon',
    'eagle': '31. Bald eagle', 'koi': '32. Koi pond', 'stag': '33. Stag at dawn', 'sea_turtle': '34. Sea turtle',
    'bonsai': '35. Bonsai', 'octopus': '36. Octopus',
    'panda': '37. Panda', 'hedgehog': '38. Hedgehog', 'peacock': '39. Peacock', 'rocket': '40. Rocket launch',
    'windmill': '41. Windmill', 'dragon': '42. Little dragon',
}
LABELS.update({'sea_turtle_2': 'Sea turtle (v2)', 'heron_sun': 'Heron in front of the sun', 'raven_2': 'Raven',
               'koi_2': 'Koi pond', 'heron_sun_2': 'Heron in front of the sun (dusk sea)', 'heron_sun_3': 'Heron in front of the sun (still water)',
               'coopers_hawk_2': "Cooper's hawk (previous)", 'coopers_hawk_3': "Cooper's hawk (new)", 'raven_3': 'Raven', 'heron_sun_4': 'Heron in front of the sun (marsh)',
               'heron_sun_5': 'Heron in front of the sun (mountains)', 'whale_breach': 'Humpback breaching'})
items = [(f'{i}. ' + LABELS[k].split('. ', 1)[-1], fn()) for i, (k, fn) in enumerate(FIGURES.items(), 1)]
for i in range(0, len(items), 2):
    pair = items[i:i + 2]
    arts = [c.ansi() for _, c in pair]
    widths = [c.w for _, c in pair]
    h = max(len(a) for a in arts)
    print('   '.join(label.ljust(w + 6) for (label, _), w in zip(pair, widths)))
    for r in range(h):
        row = ''
        for a, w in zip(arts, widths):
            row += (a[r] if r < len(a) else ' ' * w) + ' ' * 9
        print(row)
    print()
