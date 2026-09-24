from pix import *

def coopers_hawk():
    c = Canvas(24, 32)
    tail = poly([(11.2, 18), (15.2, 17.6), (17.2, 31.6), (13.2, 31.8)])
    c.fill(tail, 'blue')
    for y in (23.2, 26.6, 30):                                        # tail bands
        c.fill(both(tail, rect(0, y, 30, y + 1)), 'gray')
    c.fill(both(tail, rect(0, 31, 30, 32)), 'whiteB')                 # white tail tip
    c.fill(ell(12, 13, 5, 7.4, -12), 'blue')                          # body / back
    chest = ell(9.6, 14.6, 3.2, 5.8, -6)
    c.fill(chest, 'whiteB')
    for y in range(10, 20, 2):                                         # dotted rufous barring
        c.fill(both(chest, lambda x, yy, y=y: int(yy) == y and int(x) % 2 == (y // 2) % 2), 'redB')
    wing = ell(14.6, 13.4, 3.2, 6.6, -14)
    c.fill(wing, 'blue')
    c.fill(both(wing, rect(16.2, 0, 30, 30)), 'blueB')                # light edge on the wing
    for y in (15, 17.4):
        c.fill(both(wing, rect(0, y, 30, y + 0.5)), 'gray')           # feather rows
    head = ell(8.6, 6, 4, 3.6)
    c.fill(head, 'blue')
    c.fill(both(head, rect(0, 0, 30, 5.1)), 'gray')                   # dark cap
    c.px([(7, 7), (8, 7), (8, 8)], 'redB')                             # rufous cheek
    c.fill(poly([(6, 5.2), (2.6, 5.8), (2, 7.6), (3, 7.2), (6, 7.8)]), 'gray')  # hooked beak
    c.px([(2, 7)], 'gray')
    c.px([(5, 5)], 'yellow')                                           # cere
    c.px([(6, 4)], 'redB'); c.px([(7, 4)], 'black')                    # eye
    c.fill(rect(9.2, 20, 10, 23.4), 'yellow'); c.fill(rect(11.8, 20, 12.6, 23.4), 'yellow')  # legs
    c.px([(8, 23), (11, 23), (13, 23)], 'yellowB')                     # toes
    c.fill(rect(0, 23.6, 22, 25), 'yellow')                            # branch
    c.px([(3, 25), (18, 25), (19, 25)], 'yellow')
    return c

def hawk_flight():
    c = Canvas(36, 26)
    tail = poly([(15.6, 13), (20.4, 13), (21.6, 24.6), (14.4, 24.6)])
    c.fill(tail, 'whiteB')
    for y in (16.4, 19.6, 22.8):
        c.fill(both(tail, rect(0, y, 40, y + 1)), 'gray')
    c.fill(both(tail, rect(0, 24, 40, 26)), 'whiteB')
    # short, rounded accipiter wings: broad at the body, rounded at the tip
    wings = [minus(ell(9.6, 9.2, 9.2, 4.2, -6), rect(18, 0, 40, 40)),
             minus(ell(26.4, 9.2, 9.2, 4.2, 6), rect(0, 0, 18, 40))]
    for w in wings:
        c.fill(w, 'whiteB')
        c.fill(both(w, lambda x, y: int(x) % 3 == 0 and int(y) % 2 == 0), 'gray')     # fine barring
        c.fill(both(w, lambda x, y: y > 11.6), 'blue')                                  # dark trailing edge
    for x in (1, 3, 5):                                                                   # splayed primaries
        c.px([(x, 11), (x, 12)], 'blue'); c.px([(35 - x, 11), (35 - x, 12)], 'blue')
    body = ell(18, 10, 3, 5.6)
    c.fill(body, 'whiteB')
    for y in range(7, 15, 2):
        c.fill(both(body, lambda x, yy, y=y: int(yy) == y and int(x) % 2 == 0), 'redB')
    head = ell(18, 3.8, 2.4, 2.4)
    c.fill(head, 'blue'); c.fill(both(head, rect(0, 0, 40, 2.8)), 'gray')
    c.px([(16, 4), (20, 4)], 'redB'); c.px([(18, 5)], 'yellow')
    return c

def owl():
    c = Canvas(26, 28)
    c.fill(ell(13, 16, 9, 10), 'yellow')                             # body
    c.fill(ell(13, 18.5, 5.4, 6.6), 'yellowB')                       # chest
    for y in range(14, 25, 2):
        c.fill(both(ell(13, 18.5, 5.4, 6.6), lambda x, yy, y=y: int(yy) == y and int(x) % 2 == 0), 'yellow')
    c.fill(ell(13, 8, 8, 6.4), 'yellow')                             # head
    c.fill(poly([(5, 4), (4, -0.5), (8.6, 3)]), 'yellow'); c.fill(poly([(21, 4), (22, -0.5), (17.4, 3)]), 'yellow')  # ear tufts
    c.fill(ell(9.2, 8.4, 3.4, 3.4), 'whiteB'); c.fill(ell(16.8, 8.4, 3.4, 3.4), 'whiteB')     # facial disc
    c.fill(ell(9.2, 8.4, 2, 2), 'yellowB'); c.fill(ell(16.8, 8.4, 2, 2), 'yellowB')          # eyes
    c.px([(9, 8), (16, 8)], 'black'); c.px([(9, 7), (16, 7)], 'black')
    c.fill(poly([(12, 10), (14, 10), (13, 13)]), 'gray')             # beak
    c.fill(ell(5, 16, 2.6, 7, 10), 'red'); c.fill(ell(21, 16, 2.6, 7, -10), 'red')           # wings
    c.px([(9, 25), (10, 25), (15, 25), (16, 25)], 'gray')            # talons
    c.fill(rect(0, 25.6, 26, 27), 'red')                              # branch
    return c

def raven():
    c = Canvas(30, 22)
    c.fill(poly([(21, 9), (29.6, 12.6), (29, 15.4), (20, 14)]), 'gray')   # tail
    c.fill(ell(15, 11, 8, 5, 10), 'gray')                             # body
    c.fill(ell(16.5, 10, 5.5, 3.4, 12), 'blue')                       # wing sheen
    c.fill(both(ell(16.5, 10, 5.5, 3.4, 12), rect(0, 0, 40, 8.6)), 'blueB')
    c.fill(ell(8, 6, 3.8, 3.4), 'gray')                               # head
    c.fill(poly([(5, 5), (0.4, 6.4), (1, 7.2), (5, 8)]), 'black')     # heavy beak
    c.fill(poly([(5, 5), (0.4, 6.4), (5, 6.4)]), 'gray')
    c.px([(7, 5)], 'whiteB')                                          # eye
    c.px([(10, 8), (11, 9)], 'blue')                                  # throat hackles
    c.fill(rect(11.4, 15.4, 12.2, 19), 'black'); c.fill(rect(15, 15.4, 15.8, 19), 'black')   # legs
    c.fill(rect(0, 19, 24, 20.2), 'green')                            # ground
    return c

def heron():
    c = Canvas(24, 32)
    c.fill(poly([(7, 3.4), (0, 4.6), (7, 5.4)]), 'yellowB')          # dagger beak
    c.fill(ell(9, 4.2, 2.6, 2.2), 'whiteB')                           # head
    c.fill(rect(8.4, 2, 13, 2.8), 'black')                            # crest plume
    c.px([(8, 3)], 'yellow')                                          # eye
    c.fill(poly([(9, 5.6), (11, 5.6), (10, 11), (12, 15), (10, 16), (8, 11)]), 'blueB')     # S-neck
    c.fill(ell(14, 17, 6.4, 4, 18), 'blue')                           # body
    c.fill(both(ell(14, 17, 6.4, 4, 18), rect(0, 0, 40, 15.4)), 'blueB')
    c.fill(poly([(18, 17), (23.6, 21), (19, 21)]), 'gray')            # tail plumes
    c.fill(rect(12, 20.6, 12.8, 29), 'yellow'); c.fill(rect(15, 20.6, 15.8, 29), 'yellow')  # legs
    c.fill(rect(0, 28.6, 24, 29.4), 'cyan'); c.fill(rect(2, 30.4, 20, 31), 'cyanB')          # water
    return c

def robin():
    c = Canvas(26, 20)
    c.fill(poly([(18, 7), (25.6, 4), (25.6, 8), (19, 11)]), 'gray')   # tail
    c.fill(ell(13, 10, 7, 5, 6), 'gray')                              # back
    c.fill(ell(11, 12, 5, 3.8, 4), 'redB')                            # orange breast
    c.fill(both(ell(11, 12, 5, 3.8, 4), rect(0, 14.6, 40, 20)), 'whiteB')
    c.fill(ell(15.5, 9, 4, 2.6, 8), 'blue')                           # wing
    c.fill(ell(7, 5.4, 3.4, 3), 'gray')                               # head
    c.fill(poly([(4, 5), (0.6, 5.8), (4, 6.8)]), 'yellowB')           # beak
    c.px([(6, 4)], 'whiteB'); c.px([(6, 5)], 'black')                 # eye + ring
    c.fill(rect(10, 15.6, 10.8, 18.4), 'yellow'); c.fill(rect(13, 15.6, 13.8, 18.4), 'yellow')
    c.fill(rect(0, 18.4, 26, 19.6), 'green')                          # grass
    c.px([(2, 17), (5, 17), (20, 17), (23, 17)], 'greenB')
    return c

def cardinal():
    c = Canvas(24, 24)
    c.fill(poly([(15, 13), (23.6, 17), (22.6, 20), (15, 17)]), 'red')    # tail
    c.fill(ell(11, 13, 6.4, 5.4, 12), 'redB')                           # body
    c.fill(ell(13.5, 12.5, 4, 3, 18), 'red')                             # wing
    c.fill(ell(8, 7, 3.6, 3.4), 'redB')                                  # head
    c.fill(poly([(7, 4.4), (10.6, -0.4), (11.4, 5)]), 'redB')           # crest
    c.fill(poly([(4.4, 6), (6.6, 6), (7.6, 9.6), (4, 9.6)]), 'black')   # black mask
    c.fill(poly([(4.8, 6.6), (1.4, 7.6), (4.8, 9)]), 'yellowB')         # orange beak
    c.px([(6, 6)], 'whiteB')                                             # eye glint
    c.fill(rect(9, 18, 9.8, 21), 'gray'); c.fill(rect(12, 18, 12.8, 21), 'gray')
    c.fill(rect(0, 20.6, 20, 21.8), 'yellow')                            # branch
    c.px([(15, 22), (16, 23)], 'yellow')
    return c

def hummingbird():
    c = Canvas(30, 20)
    c.fill(poly([(12, 8), (14, 0.4), (20, 0), (16.6, 8.6)]), 'whiteB')    # blurred wing
    c.fill(both(poly([(12, 8), (14, 0.4), (20, 0), (16.6, 8.6)]), rect(0, 0, 40, 3)), 'gray')
    c.fill(ell(14, 10, 5.4, 2.8, 18), 'green')                           # body
    c.fill(both(ell(14, 10, 5.4, 2.8, 18), rect(0, 10.6, 40, 20)), 'greenB')
    c.fill(poly([(18, 11), (26, 16.6), (22, 17.4)]), 'green')            # tail
    c.fill(ell(8.6, 8, 2.6, 2.4), 'greenB')                              # head
    c.fill(ell(8.4, 10.2, 2, 1.2), 'redB')                               # ruby throat
    c.fill(poly([(6.4, 7.6), (0, 8.4), (6.4, 8.8)]), 'gray')             # needle beak
    c.px([(8, 7)], 'black'); c.px([(9, 7)], 'whiteB')
    c.fill(ell(3, 15, 2, 2), 'magentaB'); c.fill(ell(3, 15, .9, .9), 'yellowB')   # flower
    c.fill(rect(2.6, 16.6, 3.4, 20), 'green')
    return c

def fox():
    c = Canvas(28, 26)
    c.fill(poly([(15, 18), (26, 10), (27.6, 16), (19, 24)]), 'redB')   # tail
    c.fill(both(poly([(15, 18), (26, 10), (27.6, 16), (19, 24)]), rect(24, 0, 40, 40)), 'whiteB')  # white tip
    c.fill(ell(12, 17, 5.4, 7), 'redB')                                   # body
    c.fill(ell(10, 17, 2.6, 5), 'whiteB')                                 # chest
    c.fill(ell(9, 8, 4.4, 3.8), 'redB')                                   # head
    c.fill(poly([(5, 6), (5, 0.6), (8.4, 4.4)]), 'redB'); c.fill(poly([(10, 4.4), (13, 0.6), (13.4, 6)]), 'redB')  # ears
    c.px([(6, 3), (6, 4), (12, 3), (12, 4)], 'black')                    # inner ears
    c.fill(poly([(5, 8.4), (0.6, 10), (5, 11.8)]), 'redB')               # snout
    c.fill(ell(6, 10.6, 2.6, 1.3), 'whiteB')                              # muzzle
    c.px([(0, 10)], 'black'); c.px([(7, 7)], 'black')                     # nose, eye
    c.fill(rect(8.4, 22, 9.4, 25), 'black'); c.fill(rect(12, 22, 13, 25), 'black')  # legs
    c.fill(rect(0, 25, 28, 26), 'green')
    return c

def mountain_lake():
    c = Canvas(34, 22)
    c.fill(ell(24, 7, 4.2, 4.2), 'yellowB')                               # sun
    c.fill(ell(24, 7, 2.6, 2.6), 'whiteB')
    c.fill(poly([(0, 13), (8, 3), (13, 8), (17, 5), (26, 13)]), 'blue')  # far range
    c.fill(poly([(12, 13), (22, 5.5), (34, 13)]), 'gray')                # near peak
    c.fill(poly([(6.4, 5), (8, 3), (9.6, 5), (8.6, 4.6), (8, 5.4), (7.2, 4.6)]), 'whiteB')  # snowcaps
    c.fill(poly([(20, 7.2), (22, 5.5), (24, 7.2), (23, 7), (22, 8), (21, 7)]), 'whiteB')
    for x0 in (2, 5, 29, 31.4):                                           # pines
        c.fill(poly([(x0, 13), (x0 + 1.4, 8.6), (x0 + 2.8, 13)]), 'green')
    c.fill(rect(0, 13, 34, 22), 'blue')                                   # lake
    for y, x0, x1, t in ((14.2, 20, 28, 'yellowB'), (15.8, 21, 27, 'yellow'), (17.4, 22, 26, 'yellowB'), (19, 23, 25, 'yellow'), (16, 2, 8, 'cyan'), (19.6, 6, 14, 'cyan'), (18, 28, 32, 'cyan')):
        c.fill(rect(x0, y, x1, y + 0.7), t)                                # sun path + ripples
    return c

def kingfisher():
    c = Canvas(26, 22)
    c.fill(poly([(16, 11), (22, 14.6), (21, 16.6), (15.4, 14)]), 'blue')        # stubby tail
    c.fill(ell(12, 11, 5, 4.6, 14), 'blueB')                                    # back
    c.fill(ell(10.6, 13, 3.6, 3.2), 'redB')                                     # rufous belly
    c.fill(ell(14, 10.4, 3.2, 2.6, 18), 'cyan')                                 # wing
    for x in range(12, 18, 2):
        c.px([(x, 11)], 'whiteB')                                                # wing spots
    c.fill(ell(7.6, 6, 4.4, 3.8), 'blueB')                                      # big head
    c.fill(both(ell(7.6, 6, 4.4, 3.8), rect(0, 0, 40, 3.6)), 'blue')            # barred crown
    c.fill(poly([(4, 5), (0, 6.2), (4, 7.6)]), 'gray')                          # long bill
    c.px([(6, 6), (7, 6)], 'redB'); c.px([(7, 8), (8, 8), (9, 8)], 'whiteB')     # eye stripe, collar
    c.px([(6, 5)], 'black')
    c.fill(rect(9.4, 16, 10.2, 18), 'redB'); c.fill(rect(11.4, 16, 12.2, 18), 'redB')
    c.fill(rect(0, 18, 20, 19.2), 'yellow')                                      # branch over water
    c.fill(rect(0, 20.6, 26, 21.4), 'cyan')
    return c

def puffin():
    c = Canvas(20, 26)
    c.fill(ell(10, 15, 5.6, 7.6), 'gray')                                       # dark back
    c.fill(ell(9, 16, 3.6, 6), 'whiteB')                                        # white belly
    c.fill(ell(9, 6, 4.6, 4.2), 'gray')                                         # head
    c.fill(ell(8, 7, 3, 2.6), 'whiteB')                                         # white face
    c.fill(poly([(5, 5), (1, 6.6), (1.4, 8.6), (5, 9.4)]), 'redB')              # big bill
    c.fill(poly([(5, 5), (3, 5.8), (5, 6.8)]), 'yellowB')
    c.px([(2, 7), (3, 7)], 'yellow')                                             # bill stripes
    c.px([(7, 6)], 'black'); c.px([(8, 6)], 'red')                              # eye + eye mark
    c.fill(ell(13, 14, 2.6, 5, -8), 'black')                                    # wing
    c.fill(rect(6.6, 22, 8.2, 23.4), 'redB'); c.fill(rect(10.6, 22, 12.2, 23.4), 'redB')  # orange feet
    c.fill(poly([(0, 26), (3, 23.4), (17, 23.4), (20, 26)]), 'gray')           # rock
    c.px([(5, 24), (14, 25)], 'whiteB')
    return c

def blue_jay():
    c = Canvas(26, 22)
    c.fill(poly([(16, 11), (25.6, 13), (25, 16.6), (16, 15)]), 'blueB')         # long tail
    for x in (18, 21, 24):
        c.fill(both(poly([(16, 11), (25.6, 13), (25, 16.6), (16, 15)]), rect(x, 0, x + 0.7, 40)), 'black')
    c.fill(ell(12, 12, 5.6, 4.4, 10), 'blueB')                                  # back
    c.fill(ell(10, 14, 3.6, 3), 'whiteB')                                       # pale breast
    c.fill(ell(14.4, 11.6, 3.4, 2.4, 12), 'blue')                               # wing
    c.px([(13, 12), (15, 12), (17, 12)], 'whiteB')                              # white wing bars
    c.fill(ell(7, 7, 3.4, 3), 'blueB')                                           # head
    c.fill(poly([(6, 4.6), (10, -0.2), (11, 5)]), 'blueB')                      # crest
    c.fill(ell(6, 8.2, 2.6, 1.6), 'whiteB')                                     # face
    c.fill(rect(4, 10, 10, 10.8), 'black')                                       # necklace
    c.fill(poly([(4, 6.6), (0.6, 7.4), (4, 8.2)]), 'black')                     # bill
    c.px([(5, 6)], 'black')
    c.fill(rect(9, 17, 9.8, 19.4), 'gray'); c.fill(rect(12, 17, 12.8, 19.4), 'gray')
    c.fill(rect(0, 19.4, 22, 20.6), 'yellow')
    return c

def loon():
    c = Canvas(32, 18)
    c.fill(ell(17, 10, 10, 3.6), 'gray')                                        # low body
    for x in range(10, 26, 2):
        c.px([(x, 8), (x + 1, 10)], 'whiteB')                                    # checkered back
    c.fill(ell(8, 5.4, 2.8, 2.4), 'gray')                                       # head
    c.fill(poly([(8.6, 6.6), (10.6, 6.6), (11.6, 9.4), (9, 9.6)]), 'gray')      # neck
    c.fill(rect(8.6, 7.6, 11, 8.2), 'whiteB')                                   # necklace
    c.fill(poly([(5.6, 5), (1, 6), (5.6, 6.4)]), 'black')                       # dagger bill
    c.px([(7, 4)], 'redB')                                                       # red eye
    c.fill(rect(0, 12.4, 32, 18), 'blue')                                        # lake
    c.fill(rect(6, 12.4, 28, 13), 'blueB')                                       # waterline
    for y, x0, x1 in ((14.4, 4, 12), (15.8, 16, 26), (17, 8, 14)):
        c.fill(rect(x0, y, x1, y + .6), 'cyan')
    c.fill(ell(28, 3, 1.6, 1.6), 'yellowB')                                     # low sun
    return c

def lighthouse():
    c = Canvas(28, 30)
    c.fill(poly([(12, 5.4), (0, 1), (0, 6)]), 'yellowB'); c.fill(poly([(16, 5.4), (28, 2), (28, 7)]), 'yellowB')  # beams
    c.fill(poly([(12, 5.4), (0, 1), (0, 2.6)]), 'yellow'); c.fill(poly([(16, 5.4), (28, 2), (28, 3.6)]), 'yellow')
    c.fill(poly([(11, 4), (14, 1), (17, 4)]), 'red')                             # cap
    c.fill(rect(11.4, 4, 16.6, 7), 'yellowB')                                    # lantern room
    c.fill(rect(12.4, 4.6, 15.6, 6.4), 'whiteB')
    c.fill(rect(10.6, 7, 17.4, 8), 'gray')                                       # gallery
    tower = poly([(11.4, 8), (16.6, 8), (18, 24), (10, 24)])
    c.fill(tower, 'whiteB')
    for y in (11, 17):
        c.fill(both(tower, rect(0, y, 40, y + 3)), 'redB')                       # stripes
    c.px([(14, 13), (14, 19)], 'gray')                                           # windows
    c.fill(poly([(4, 30), (7, 24), (21, 24), (24, 30)]), 'gray')                 # rocks
    c.fill(rect(0, 27, 4, 30), 'blue'); c.fill(rect(24, 27, 28, 30), 'blue')
    c.px([(1, 27), (2, 27), (25, 28), (26, 28)], 'cyan')
    for x, y in ((3, 10), (22, 12), (6, 16), (25, 18), (20, 0)):
        c.px([(x, y)], 'whiteB')                                                 # stars
    return c

def moon_pines():
    c = Canvas(30, 22)
    c.fill(minus(ell(22, 4.6, 3.8, 3.8), ell(24, 3.4, 3.1, 3.1)), 'yellowB')    # crescent moon
    for x, y in ((4, 2), (9, 5), (14, 1), (27, 11), (2, 9), (12, 9)):
        c.px([(x, y)], 'whiteB')
    for cx, h, tone in ((3.5, 9, 'green'), (10, 13, 'greenB'), (17, 10, 'green'), (24.5, 12, 'greenB')):
        top = 19 - h
        for k in range(3):                                            # three tiers per tree
            t0 = top + k * h / 3.4
            half = 1.6 + k * 1.3
            c.fill(poly([(cx, t0), (cx - half, t0 + h / 2.2), (cx + half, t0 + h / 2.2)]), tone)
        c.fill(rect(cx - 0.5, 18.4, cx + 0.5, 20), 'yellow')       # trunk
    c.fill(rect(0, 20, 30, 22), 'gray')
    return c

def journal():
    c = Canvas(30, 22)
    c.fill(poly([(1, 8), (15, 10), (15, 21), (1, 19)]), 'whiteB')               # left page
    c.fill(poly([(29, 8), (15, 10), (15, 21), (29, 19)]), 'whiteB')             # right page
    c.fill(rect(14.6, 10, 15.4, 21), 'gray')                                     # spine
    for y in (12, 14, 16):
        c.fill(poly([(3, y), (13, y + 1.4), (13, y + 2), (3, y + 0.6)]), 'gray')  # lines of writing
    for y in (12, 14):
        c.fill(poly([(17, y + 1.4), (26, y), (26, y + 0.6), (17, y + 2)]), 'gray')
    c.fill(poly([(0, 19), (15, 21.4), (30, 19), (30, 20.4), (15, 22), (0, 20.4)]), 'red')   # cover
    c.fill(poly([(21, 17), (28.6, 1), (30, 2.6), (22, 17.6)]), 'blueB')          # quill feather
    c.fill(poly([(24, 10), (28.6, 1), (29, 6)]), 'blue')
    c.px([(21, 17), (20, 18)], 'black')                                          # nib + ink
    c.fill(ell(4, 4, 2.6, 2.4), 'gray'); c.fill(ell(4, 3.2, 2, 1), 'blue')      # ink pot
    return c

def sailboat():
    c = Canvas(30, 22)
    c.fill(ell(6, 5, 3.4, 3.4), 'redB')                                          # setting sun
    c.fill(both(ell(6, 5, 3.4, 3.4), rect(0, 5.2, 40, 40)), 'yellowB')
    c.fill(poly([(15, 1), (15, 14), (6, 14)]), 'whiteB')                         # mainsail
    c.fill(poly([(16, 3), (16, 14), (23, 14)]), 'whiteB')                        # jib
    c.fill(both(poly([(15, 1), (15, 14), (6, 14)]), rect(0, 11, 40, 12)), 'redB')  # sail stripe
    c.fill(rect(15, 0.6, 16, 15), 'gray')                                        # mast
    c.fill(poly([(5, 15), (25, 15), (22, 18), (8, 18)]), 'red')                  # hull
    c.fill(rect(0, 18, 30, 22), 'blue')                                          # sea
    for y, x0, x1 in ((19, 2, 10), (20.4, 14, 26), (21.4, 4, 12)):
        c.fill(rect(x0, y, x1, y + .6), 'cyan')
    c.fill(rect(4, 18.6, 8, 19.2), 'yellowB')                                    # sun on the water
    return c

def heron_flight():
    c = Canvas(38, 22)
    near = poly([(13.4, 10.4), (16, 6), (21, 2.4), (28, 0.4), (35, 0.6), (30, 3.4), (24, 7), (21, 10.6)])   # long raised near wing
    c.fill(near, 'blue')
    c.fill(both(near, lambda x, y: x > 27), 'gray')                                   # dark primaries
    c.fill(both(near, lambda x, y: 16 < x < 26 and int(y) == int(9.6 - (x - 16) * 0.7)), 'blueB')   # covert line
    far = poly([(15, 12.4), (19, 16.6), (26, 18.4), (29, 17.4), (22, 12.2)])
    c.fill(far, 'blueB')
    c.fill(both(far, lambda x, y: y > 16), 'gray')
    c.fill(ell(17.4, 11.6, 7, 2.2, -3), 'blue')                                        # body
    c.fill(poly([(23.6, 10.6), (27, 11.4), (23.6, 12.6)]), 'blue')                    # short tail
    c.fill(ell(11.4, 12.2, 1.8, 1.6), 'blueB')                                          # folded neck (the S bulge)
    c.fill(ell(9.6, 10.4, 2, 1.7), 'whiteB')                                            # head, drawn in close
    c.fill(rect(10, 9, 13.4, 9.6), 'black')                                             # crest
    c.fill(poly([(8, 10), (1.4, 11), (8, 11.4)]), 'yellowB')                           # bill forward
    c.px([(9, 10)], 'yellow')
    c.fill(rect(24, 12.2, 36.8, 12.8), 'yellow'); c.fill(rect(24, 14.2, 35.8, 14.8), 'yellow')   # legs trailing
    c.px([(37, 11), (36, 15)], 'yellow')                                                # feet
    c.fill(rect(0, 20.6, 38, 21.4), 'cyan'); c.fill(rect(6, 21.6, 20, 22), 'cyanB')   # water far below
    return c

def tiger():
    c = Canvas(28, 26)
    for ex in (5, 23):                                                                 # ears
        c.fill(ell(ex, 4.4, 3.4, 3.4), 'redB'); c.fill(ell(ex, 4.8, 1.8, 1.8), 'whiteB')
        c.fill(ell(ex, 5.2, 1, 1), 'black')
    head = ell(14, 13, 10.4, 9.6)
    c.fill(head, 'redB')
    for x in (11, 14, 17):                                                             # forehead stripes
        c.fill(rect(x, 4, x + 0.9, 7.4 - abs(x - 14) * 0.6), 'black')
    for side in (1, -1):                                                               # side stripes
        for k, y in enumerate((9, 12.4, 15.8)):
            x0 = 14 + side * 10.6
            c.fill(both(head, poly([(x0, y), (x0 - side * (4.2 - k * 0.6), y + 0.9), (x0 - side * (4.2 - k * 0.6), y + 1.9), (x0, y + 1.6)])), 'black')
    c.fill(ell(8.6, 9.6, 2.6, 1.2), 'whiteB'); c.fill(ell(19.4, 9.6, 2.6, 1.2), 'whiteB')   # brows
    c.fill(ell(9.4, 11.4, 1.8, 1.2), 'greenB'); c.fill(ell(18.6, 11.4, 1.8, 1.2), 'greenB') # eyes
    c.px([(9, 11), (18, 11)], 'black')
    c.fill(ell(9.4, 17.4, 4.4, 3.2), 'whiteB'); c.fill(ell(18.6, 17.4, 4.4, 3.2), 'whiteB')  # muzzle cheeks
    c.fill(ell(14, 20.4, 3.4, 2), 'whiteB')                                            # chin
    c.fill(poly([(12, 14.6), (16, 14.6), (14, 17.2)]), 'red')                          # nose
    c.fill(rect(13.6, 17.2, 14.4, 18.6), 'black')
    c.px([(12, 19), (13, 19), (15, 19), (16, 19)], 'black')                            # mouth
    for x, y in ((7, 17), (9, 18), (7, 19), (20, 17), (18, 18), (20, 19)):
        c.px([(x, y)], 'black')                                                        # whisker dots
    return c

def lighthouse_cliff():
    c = Canvas(32, 30)
    c.fill(ell(5, 5, 3, 3), 'yellowB')                                                 # sun
    c.px([(24, 3), (25, 2), (26, 3), (28, 5), (29, 4), (30, 5)], 'gray')              # gulls
    c.fill(poly([(0, 30), (0, 20), (6, 17.4), (24, 17.4), (28, 21), (28, 30)]), 'green')    # cliff
    c.fill(both(poly([(0, 30), (0, 20), (6, 17.4), (24, 17.4), (28, 21), (28, 30)]), rect(0, 22, 40, 40)), 'gray')  # rock face
    c.fill(rect(28, 23, 32, 30), 'blue')                                               # sea
    c.px([(29, 24), (31, 26), (30, 28)], 'whiteB')                                     # whitecaps
    tower = poly([(18.4, 6.6), (22.6, 6.6), (23.6, 17.4), (17.4, 17.4)])
    c.fill(tower, 'whiteB')
    c.fill(both(tower, rect(0, 13, 40, 14.4)), 'red')                                  # band
    c.fill(rect(18, 3.6, 23, 6.6), 'yellowB'); c.fill(rect(18.8, 4.2, 22.2, 6), 'whiteB')   # lantern
    c.fill(poly([(17.6, 3.6), (20.5, 0.6), (23.4, 3.6)]), 'red')                       # roof
    c.fill(rect(17, 6.6, 24, 7.4), 'gray')                                             # gallery
    c.px([(20, 10)], 'gray')
    c.fill(rect(8, 13.6, 15, 17.4), 'whiteB')                                          # keeper's cottage
    c.fill(poly([(7, 13.8), (11.5, 10), (16, 13.8)]), 'red')
    c.px([(10, 15), (13, 15)], 'blue'); c.fill(rect(11.4, 15.4, 12.4, 17.4), 'yellow')
    c.fill(rect(0, 24, 3, 30), 'gray')
    return c

def coffee():
    c = Canvas(24, 24)
    for x0 in (8, 12):                                                                 # steam curls
        c.px([(x0, 1), (x0 + 1, 2), (x0 + 1, 3), (x0, 4), (x0, 5), (x0 + 1, 6)], 'gray')
    c.fill(rect(5, 8, 17, 19), 'whiteB')                                               # mug
    c.fill(rect(5, 8, 17, 9), 'yellow')                                                # coffee surface
    c.fill(rect(5, 12, 17, 14), 'blueB')                                               # band
    c.fill(minus(ell(18, 13.4, 3.4, 3.2), ell(18, 13.4, 1.8, 1.6)), 'whiteB')          # handle
    c.fill(rect(5, 8, 17, 19), 'whiteB', only=(None,))
    c.fill(ell(11, 20.6, 8.6, 1.6), 'gray')                                            # saucer
    c.px([(9, 13), (11, 13), (13, 13)], 'whiteB')
    return c

def sleeping_cat():
    c = Canvas(28, 18)
    c.fill(ell(14, 15, 12, 2.6), 'red')                                                # cushion
    c.fill(ell(14, 11, 8.6, 4.4), 'gray')                                              # curled body
    c.fill(minus(ell(15, 12.6, 9.4, 3.4), ell(15, 11.4, 8, 3.4)), 'whiteB')            # tail wrapped round
    c.fill(ell(8, 9.6, 3.6, 3), 'gray')                                                # head tucked in
    c.fill(poly([(5.4, 7.6), (5.6, 4.6), (7.8, 6.8)]), 'gray'); c.fill(poly([(8.6, 6.8), (10.6, 4.8), (10.8, 8)]), 'gray')   # ears
    c.px([(7, 10), (9, 10)], 'black')                                                  # closed eyes
    c.px([(8, 11)], 'redB')                                                            # nose
    c.fill(ell(10, 12, 2, 1.2), 'whiteB')                                              # paw
    for x, y in ((17, 4), (19, 2), (22, 0)):                                           # z z z
        c.px([(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)], 'blueB')
    return c

def chess_knight():
    c = Canvas(22, 28)
    knight = poly([(6, 22), (7, 16), (5.4, 13), (3, 12.6), (1.6, 10.6), (4, 7), (7, 4.6), (8, 1.4), (10, 3.4),
                   (13, 3.2), (16.4, 6.4), (18, 12), (17, 17), (16, 22)])
    c.fill(knight, 'whiteB')
    c.fill(both(knight, lambda x, y: x > 13.6), 'gray')                           # shaded side
    for y in range(5, 17, 2):                                                      # mane
        c.px([(14, y), (15, y + 1)], 'blueB')
    c.px([(8, 7)], 'black'); c.px([(3, 11), (4, 11)], 'gray')                     # eye, nostril
    c.fill(rect(4, 22, 18, 24), 'whiteB'); c.fill(rect(3, 24, 19, 26), 'whiteB')  # base
    c.fill(both(rect(3, 22, 19, 26), lambda x, y: x > 14), 'gray')
    c.fill(rect(0, 26.2, 22, 27.6), 'yellow')                                      # board edge
    for x in range(0, 22, 4):
        c.fill(rect(x, 26.2, x + 1.8, 27.6), 'red')
    return c

def penguin():
    c = Canvas(20, 26)
    c.fill(ell(10, 14, 6.6, 9), 'gray')                                            # back
    c.fill(ell(10, 15.6, 4.4, 7.2), 'whiteB')                                      # belly
    c.fill(ell(10, 6, 4.6, 4.4), 'gray')                                           # head
    c.fill(ell(8.4, 6.6, 1.8, 1.6), 'whiteB'); c.fill(ell(11.6, 6.6, 1.8, 1.6), 'whiteB')
    c.px([(8, 6), (11, 6)], 'black')
    c.fill(poly([(9, 8), (11, 8), (10, 10)]), 'yellowB')                          # beak
    c.fill(ell(10, 10.6, 3.6, 1.2), 'yellowB', only=('whiteB',))                  # yellow bib
    c.fill(ell(3.8, 14.6, 1.6, 5, 16), 'gray'); c.fill(ell(16.2, 14.6, 1.6, 5, -16), 'gray')   # flippers
    c.fill(ell(7.4, 23.2, 2.2, 0.9), 'yellowB'); c.fill(ell(12.6, 23.2, 2.2, 0.9), 'yellowB')  # feet
    c.fill(rect(0, 24.2, 20, 26), 'whiteB'); c.px([(2, 24), (16, 24)], 'cyan')    # ice
    return c

def flamingo():
    c = Canvas(20, 32)
    c.fill(ell(12, 13, 5.4, 3.6, -12), 'magentaB')                                 # body
    c.fill(ell(13.4, 12.4, 3.4, 2.2, -14), 'magenta')                              # wing
    c.fill(poly([(16.6, 11.4), (19.6, 10), (18.4, 13.6)]), 'magenta')              # tail
    c.fill(poly([(6.4, 11.6), (8.8, 11.6), (8.2, 6.8), (6.4, 4), (4.4, 4.6), (6.4, 7.6)]), 'magentaB')   # thick S-neck
    c.fill(ell(5, 3, 2.2, 1.8), 'magentaB')                                        # head
    c.fill(poly([(3.4, 2), (0.6, 3.6), (1.2, 5.8), (3.6, 4.2)]), 'whiteB')         # bent bill
    c.px([(1, 5), (0, 4)], 'black'); c.px([(5, 2)], 'black')
    c.fill(rect(11.2, 16, 12.8, 29), 'magentaB')                                   # standing leg
    c.fill(poly([(12.4, 20.4), (15.6, 17.6), (16.6, 18.6), (12.8, 22.4)]), 'magentaB')   # tucked leg
    c.fill(rect(9, 28.2, 14.6, 29.8), 'magentaB')                                  # foot
    c.fill(rect(0, 29.8, 20, 31), 'cyan'); c.fill(rect(3, 31.2, 16, 32), 'cyanB')  # water
    return c

def wolf():
    c = Canvas(30, 28)
    c.fill(ell(6, 6, 4.2, 4.2), 'whiteB'); c.px([(5, 4), (7, 7)], 'gray')          # full moon
    for x, y in ((14, 2), (22, 1), (27, 6), (2, 14), (12, 10)):
        c.px([(x, y)], 'whiteB')
    c.fill(poly([(0, 28), (0, 25), (10, 23.6), (22, 24.4), (30, 26.6), (30, 28)]), 'gray')   # rock
    c.fill(poly([(12, 24), (6, 21.6), (4.6, 22.8), (10.6, 25.4)]), 'blue')         # tail
    c.fill(ell(14, 20.6, 5, 3.8), 'blue')                                          # haunch
    c.fill(poly([(14, 18.4), (15.6, 12), (17.4, 8), (20.6, 8.6), (19.6, 13), (19.4, 19)]), 'blue')   # chest + neck
    c.fill(ell(19, 7.6, 2.8, 2.4), 'blue')                                         # head
    c.fill(poly([(16.8, 6.6), (16.6, 2.6), (19, 5.4)]), 'blue')                   # ear
    c.fill(poly([(20, 6.4), (24.4, 2.6), (25.4, 4), (21, 8.6)]), 'blue')           # muzzle raised, howling
    c.fill(both(poly([(14, 18.4), (15.6, 12), (17.4, 8), (20.6, 8.6), (19.6, 13), (19.4, 19)]), lambda x, y: x > 18), 'blueB')   # moonlit throat
    c.fill(rect(17.2, 18, 18.8, 24.2), 'blue'); c.fill(rect(19.6, 18, 21, 24.2), 'blueB')   # front legs
    c.px([(19, 6)], 'yellowB')                                                     # eye
    return c

def whale_tail():
    c = Canvas(30, 20)
    c.fill(ell(24, 4.6, 3.4, 3.4), 'redB')                                         # low sun
    c.fill(both(ell(24, 4.6, 3.4, 3.4), rect(0, 4.8, 40, 40)), 'yellowB')
    c.fill(poly([(11, 13.4), (11.8, 8), (14.2, 8), (15, 13.4)]), 'blue')           # tail stock
    c.fill(ell(8.4, 6, 5.6, 2, 22), 'blue'); c.fill(ell(17.6, 6, 5.6, 2, -22), 'blue')   # broad flukes
    c.fill(ell(13, 8.4, 2, 1.2), 'blue')
    c.fill(both(ell(8.4, 6, 5.6, 2, 22), lambda x, y: y > 6.6), 'blueB')          # lit undersides
    c.fill(both(ell(17.6, 6, 5.6, 2, -22), lambda x, y: y > 6.6), 'blueB')
    for x, y in ((4, 6), (5, 8), (21, 8), (22, 6), (12, 10), (14, 11)):
        c.px([(x, y)], 'cyanB')                                                    # water streaming off
    c.fill(rect(0, 13, 30, 20), 'blue')                                            # sea
    c.fill(rect(8, 13, 18, 13.8), 'whiteB')                                        # splash ring
    for y, x0, x1, t in ((15, 20, 28, 'yellowB'), (16.6, 21, 27, 'yellow'), (18.2, 3, 10, 'cyan'), (17, 11, 15, 'cyan')):
        c.fill(rect(x0, y, x1, y + .7), t)
    return c

def campfire():
    c = Canvas(30, 22)
    for x, y in ((2, 1), (8, 4), (14, 0), (20, 3), (27, 1), (25, 6)):
        c.px([(x, y)], 'whiteB')
    c.fill(poly([(2, 18), (8.6, 7), (15.2, 18)]), 'green')                         # tent
    c.fill(poly([(8.6, 7), (15.2, 18), (11.6, 18)]), 'greenB')
    c.fill(poly([(7, 18), (8.6, 12), (10.2, 18)]), 'black')                        # door
    fire = poly([(20, 17), (19.4, 13), (21, 14.4), (21.6, 10), (23.4, 13.6), (24.4, 11.6), (25, 17)])
    c.fill(fire, 'redB'); c.fill(both(fire, lambda x, y: y > 14 and 20.6 < x < 24.4), 'yellowB')
    c.fill(poly([(18, 18), (26.6, 16.4), (27, 17.6), (18.4, 19.2)]), 'yellow')    # logs
    c.fill(poly([(18.4, 16.4), (27, 18), (26.6, 19.2), (18, 17.6)]), 'red')
    c.px([(22, 8), (23, 6), (21, 5)], 'yellowB')                                   # sparks
    c.fill(rect(0, 19.4, 30, 22), 'gray')
    return c

def balloon():
    c = Canvas(24, 30)
    env = ell(12, 9, 8.4, 8.6)
    c.fill(env, 'redB')
    for x0, t in ((6.6, 'yellowB'), (11, 'whiteB'), (15.4, 'yellowB')):            # stripes
        c.fill(both(env, lambda x, y, x0=x0: x0 <= x < x0 + 2 - abs(y - 9) * 0.05), t)
    c.fill(poly([(6, 15), (18, 15), (14.6, 20.6), (9.4, 20.6)]), 'redB')           # skirt
    c.fill(rect(9.4, 20.6, 10, 23), 'gray'); c.fill(rect(14, 20.6, 14.6, 23), 'gray')   # ropes
    c.fill(rect(9, 23, 15, 26), 'yellow'); c.fill(rect(9, 23, 15, 23.8), 'red')    # basket
    c.fill(ell(2.6, 26, 2.6, 1.2), 'whiteB'); c.fill(ell(20, 4, 3.4, 1.2), 'whiteB')   # clouds
    c.fill(ell(21.6, 27.6, 2.4, 1), 'whiteB')
    return c

def eagle():
    c = Canvas(26, 26)
    c.fill(poly([(14, 26), (10, 16), (20, 16), (26, 26)]), 'yellow')                # brown shoulders
    c.fill(both(poly([(14, 26), (10, 16), (20, 16), (26, 26)]), lambda x, y: int(x + y) % 4 == 0), 'red')   # feather texture
    head = ell(14, 10, 8, 7.4)
    c.fill(head, 'whiteB')                                                            # white head
    c.fill(poly([(10, 16), (13, 12), (21, 13), (20, 18)]), 'whiteB')                 # neck
    c.fill(both(head, lambda x, y: y > 13 and x > 17), 'gray')                       # shadow under the jaw
    c.fill(poly([(7, 7.6), (1, 9), (0.6, 12), (2, 14.4), (3.4, 12.6), (7.6, 12.4)]), 'yellowB')   # big hooked beak
    c.fill(poly([(0.6, 12), (2, 14.4), (2.6, 12.4)]), 'yellow')
    c.fill(rect(2.2, 11, 7.4, 11.6), 'yellow')                                        # mouth line
    c.fill(poly([(8, 6.6), (13.4, 5.6), (13, 7.4), (8.6, 8)]), 'gray')               # heavy brow
    c.fill(ell(10.6, 8.4, 1.4, 1), 'yellowB'); c.px([(10, 8)], 'black')              # fierce eye
    return c

def koi():
    c = Canvas(30, 22)
    c.fill(ell(15, 11, 15, 11), 'blue')                                              # pond
    for (cx, cy, r) in ((5, 6, 2.6), (24, 17, 3)):
        c.fill(ell(cx, cy, r, r * 0.8), 'green'); c.fill(ell(cx + .6, cy - .4, r * .5, r * .4), 'greenB')   # lily pads
    c.fill(ell(12, 9, 5, 2, -18), 'whiteB')                                          # koi 1, orange & white
    c.fill(both(ell(12, 9, 5, 2, -18), lambda x, y: x < 11 or 14 < x < 15.6), 'redB')
    c.fill(poly([(16, 6.4), (19.6, 4), (19, 8)]), 'redB')
    c.fill(ell(19, 14.6, 4.6, 1.8, 14), 'yellowB')                                   # koi 2, gold
    c.fill(poly([(14.6, 13.4), (11, 12), (11.6, 15.6)]), 'yellowB')
    c.px([(8, 10), (23, 15)], 'black')
    for x, y in ((3, 14), (7, 17), (27, 6), (21, 4)):
        c.px([(x, y)], 'cyan')                                                        # ripples
    return c

def stag():
    c = Canvas(30, 26)
    c.fill(ell(24.6, 24, 6.4, 6.4), 'redB')                                           # big sun rising behind the hill
    c.fill(ell(24.6, 24, 4.4, 4.4), 'yellowB')
    for x0, x1, y in ((15, 21, 14.2), (22, 29, 12.6), (26, 30, 15.4)):
        c.fill(rect(x0, y, x1, y + 0.7), 'redB')                                          # dawn streaks
    c.fill(rect(0, 23, 30, 26), 'green')                                              # hill
    c.fill(ell(12, 15, 6, 2.8), 'yellow')                                             # body
    c.fill(poly([(5.6, 14), (7.4, 8.4), (9.4, 8.4), (8.6, 15)]), 'yellow')            # neck
    c.fill(ell(7.4, 7.4, 2.2, 1.6), 'yellow'); c.fill(poly([(5.6, 7), (3, 8.4), (5.6, 8.8)]), 'yellow')   # head + snout
    for leg in (7, 9, 15, 17):
        c.fill(rect(leg - 0.4, 16.4, leg + 0.6, 23), 'yellow')                        # legs
    c.fill(both(ell(12, 15, 6, 2.8), lambda x, y: y > 15.6), 'yellowB')              # pale belly
    for dx in (-1, 1):                                                                 # antlers
        base = 7.4 + dx * 0.8
        c.fill(poly([(base, 6.2), (base + dx * 2, 1.4), (base + dx * 2.8, 1.6), (base + dx * .6, 6.4)]), 'whiteB')
        c.px([(int(base + dx * 1.6), 3), (int(base + dx * 2.4 + .5), 3)], 'whiteB')
    c.px([(7, 7)], 'black'); c.fill(poly([(17.6, 13.6), (19.6, 12.6), (18.4, 15)]), 'whiteB')   # eye, tail
    return c

def sea_turtle():
    c = Canvas(30, 22)
    c.fill(rect(0, 0, 30, 22), 'blue')                                               # sea
    for x, y in ((3, 2), (4, 1), (26, 18), (27, 17), (22, 3)):
        c.px([(x, y)], 'cyanB')                                                       # bubbles
    c.fill(ell(7, 9, 4.6, 1.6, -30), 'green'); c.fill(ell(22, 14, 4.2, 1.4, -30), 'green')   # flippers
    c.fill(ell(8, 15, 3.6, 1.4, 25), 'green'); c.fill(ell(21, 7, 3.6, 1.4, 25), 'green')
    shell = ell(15, 11, 7.4, 5)
    c.fill(shell, 'yellow')
    for (cx, cy) in ((12, 9), (15, 8), (18, 9), (12, 13), (15, 14), (18, 13), (15, 11)):
        c.fill(both(shell, ell(cx, cy, 1.3, 1.1)), 'yellowB')                         # shell plates
    c.fill(ell(24, 11, 2.4, 1.8), 'greenB'); c.px([(25, 10)], 'black')                # head
    c.fill(poly([(6.4, 10.4), (3, 11), (6.4, 11.8)]), 'green')                        # tail
    return c

def bonsai():
    c = Canvas(26, 24)
    c.fill(poly([(12, 20), (11, 15), (8, 11), (10, 10), (13, 13.6), (15, 9), (17, 9.6), (14.6, 15), (14.4, 20)]), 'yellow')   # twisting trunk
    for (cx, cy, rx, ry) in ((7, 8, 5, 2.6), (17, 6.4, 6, 3), (12, 4, 4, 2.2), (20, 10.4, 3.4, 1.8)):
        c.fill(ell(cx, cy, rx, ry), 'green'); c.fill(ell(cx - .6, cy - .8, rx * .6, ry * .5), 'greenB')   # foliage pads
    c.fill(poly([(4, 20), (22, 20), (20, 23.6), (6, 23.6)]), 'redB')                  # pot
    c.fill(rect(4, 20, 22, 20.8), 'red')
    c.px([(9, 19), (17, 19)], 'greenB')                                               # moss
    return c

def octopus():
    c = Canvas(28, 24)
    c.fill(ell(14, 7, 7, 6.4), 'magentaB')                                           # head/mantle
    c.fill(ell(12, 5, 2.4, 1.6), 'magenta')                                          # shine
    c.fill(ell(11, 9, 1.4, 1.4), 'whiteB'); c.fill(ell(17, 9, 1.4, 1.4), 'whiteB')
    c.px([(11, 9), (17, 9)], 'black')
    for k, x0 in enumerate((6, 9.6, 13.2, 16.8, 20.4)):                               # curling arms
        sway = 1 if k % 2 else -1
        c.fill(poly([(x0 + 1, 11), (x0 + 3, 11), (x0 + 2.4 + sway * 1.6, 17), (x0 + 1 + sway * 2.6, 21.6),
                     (x0 + sway * 2, 22), (x0 + 1 + sway * .8, 17)]), 'magentaB')
        c.px([(int(x0 + 2 + sway), 15), (int(x0 + 1.6 + sway * 1.6), 18)], 'magenta')  # suckers
    for x, y in ((3, 3), (4, 1), (24, 2)):
        c.px([(x, y)], 'cyanB')
    return c

def panda():
    c = Canvas(26, 26)
    for x in (3, 5):                                                                   # bamboo behind
        c.fill(rect(x - .5, 0, x + .6, 26), 'green')
        for y in (5, 12, 19):
            c.fill(rect(x - .8, y, x + .9, y + .6), 'greenB')
    c.px([(6, 4), (7, 3), (2, 10), (1, 9)], 'greenB')                                  # leaves
    c.fill(ell(15, 19, 7.4, 6.4), 'whiteB')                                            # body
    c.fill(ell(15, 19, 7.4, 6.4), 'black', only=None) if False else None
    c.fill(both(ell(15, 19, 7.4, 6.4), lambda x, y: y < 17.4), 'gray')                 # dark shoulders
    c.fill(ell(9, 20, 2.4, 3.4, 20), 'gray'); c.fill(ell(21, 20, 2.4, 3.4, -20), 'gray')   # arms
    c.fill(ell(10.6, 24.4, 2.6, 1.6), 'gray'); c.fill(ell(19.4, 24.4, 2.6, 1.6), 'gray')   # feet
    c.fill(ell(15, 9.6, 6.4, 5.4), 'whiteB')                                           # head
    c.fill(ell(9.8, 4.8, 2, 2), 'gray'); c.fill(ell(20.2, 4.8, 2, 2), 'gray')         # ears
    c.fill(ell(12.2, 9.6, 1.8, 2.2, 25), 'gray'); c.fill(ell(17.8, 9.6, 1.8, 2.2, -25), 'gray')   # eye patches
    c.px([(12, 9), (17, 9)], 'whiteB')
    c.fill(ell(15, 12.6, 1.2, .8), 'black')                                            # nose
    c.fill(rect(8, 17.4, 21, 18.2), 'green')                                           # bamboo stalk in paws
    c.px([(21, 16), (22, 15)], 'greenB')
    return c

def hedgehog():
    c = Canvas(26, 18)
    body = ell(14, 10.6, 9, 6)
    for k in range(9):                                                               # spiky outline along the back
        a = math.radians(200 + k * 17)
        bx, by = 14 + 8.4 * math.cos(a), 10.6 + 5.6 * math.sin(a)
        tx, ty = 14 + 11 * math.cos(a + 0.12), 10.6 + 7.6 * math.sin(a + 0.12)
        c.fill(poly([(bx - 1.2, by), (tx, ty), (bx + 1.2, by + 0.6)]), 'red')
    c.fill(body, 'yellow')
    c.fill(both(body, lambda x, y: (int(x) - 2 * int(y)) % 4 == 0 and x > 7), 'red')   # spine texture
    c.fill(ell(6.6, 13, 4, 3), 'yellowB')                                              # face
    c.fill(poly([(3.4, 12), (0.6, 13.6), (3.4, 14.8)]), 'yellowB')                    # snout
    c.px([(0, 13)], 'black'); c.px([(5, 12)], 'black')                                 # nose, eye
    c.px([(6, 15), (7, 16)], 'redB')                                                   # blush
    c.fill(rect(8, 16, 9, 17), 'yellow'); c.fill(rect(17, 16, 18, 17), 'yellow')      # feet
    c.fill(ell(22, 3, 1.6, 1.4), 'redB'); c.px([(22, 1)], 'green')                     # apple on its spines
    c.fill(rect(0, 17, 26, 18), 'green')
    return c

def peacock():
    c = Canvas(30, 28)
    fan = minus(ell(15, 14, 14.4, 13), rect(0, 20.6, 40, 40))
    c.fill(fan, 'green')                                                               # tail fan
    for r in (5, 9, 12.6):                                                             # rows of eyespots
        for k in range(9):
            a = math.radians(200 + k * (140 / 8))
            cx, cy = 15 + r * math.cos(a), 14 + r * math.sin(a) * 0.95
            if cy < 20:
                c.fill(both(fan, ell(cx, cy, 1.3, 1.3)), 'blueB'); c.px([(int(cx), int(cy))], 'yellowB')
    c.fill(both(fan, lambda x, y: (x - 15) ** 2 / 200 + (y - 14) ** 2 / 169 > 0.86), 'greenB')   # fringe
    c.fill(ell(15, 19, 2.6, 4.4), 'blue')                                              # body
    c.fill(poly([(14, 15.4), (16, 15.4), (16.4, 9.4), (13.6, 9.4)]), 'blue')           # neck
    c.fill(ell(15, 8.4, 1.8, 1.6), 'blue')                                             # head
    c.px([(14, 5), (15, 5), (16, 5), (14, 6), (15, 6), (16, 6)], 'blueB')              # crest
    c.px([(14, 8)], 'whiteB'); c.fill(poly([(13.4, 8.6), (11.6, 9.2), (13.4, 9.6)]), 'yellow')   # eye, beak
    c.fill(rect(13.6, 23.4, 14.4, 27), 'gray'); c.fill(rect(15.6, 23.4, 16.4, 27), 'gray')
    c.fill(rect(0, 26.6, 30, 28), 'green')
    return c

def rocket():
    c = Canvas(22, 32)
    for x, y in ((2, 3), (18, 1), (4, 12), (20, 9), (1, 20), (19, 18)):
        c.px([(x, y)], 'whiteB')
    body = poly([(11, 0.6), (14.4, 6), (14.4, 19), (7.6, 19), (7.6, 6)])
    c.fill(body, 'whiteB')
    c.fill(both(body, lambda x, y: x > 12.4), 'gray')                                 # shaded side
    c.fill(both(body, lambda x, y: y < 5.4), 'redB')                                   # nose cone
    c.fill(ell(11, 10, 1.8, 1.8), 'blueB'); c.fill(ell(11, 10, 1, 1), 'cyan')         # porthole
    c.fill(poly([(7.6, 14), (4, 20), (7.6, 19.4)]), 'redB'); c.fill(poly([(14.4, 14), (18, 20), (14.4, 19.4)]), 'redB')   # fins
    c.fill(rect(9, 19, 13, 20.4), 'gray')                                              # nozzle
    flame = poly([(9, 20.4), (13, 20.4), (12.4, 25), (11, 28.6), (9.6, 25)])
    c.fill(flame, 'yellowB'); c.fill(both(flame, lambda x, y: y > 23.4), 'redB')
    for (cx, cy, r) in ((6, 29, 2.6), (16, 29.4, 2.8), (11, 30.6, 3)):                # smoke
        c.fill(ell(cx, cy, r, 1.6), 'gray')
    return c

def windmill():
    c = Canvas(28, 28)
    c.fill(ell(14, 30, 16, 6), 'green')                                                # hill
    tower = poly([(11, 13), (17, 13), (18.6, 26), (9.4, 26)])
    c.fill(tower, 'whiteB'); c.fill(both(tower, lambda x, y: x > 15.6), 'gray')
    c.fill(poly([(10.6, 13.4), (14, 9.6), (17.4, 13.4)]), 'red')                      # cap
    c.fill(rect(12.8, 21.4, 15.2, 26), 'yellow'); c.px([(14, 17)], 'blue')            # door, window
    hub = (14, 11)
    for ang in (35, 125, 215, 305):                                                    # four sails
        a = math.radians(ang); ca, sa = math.cos(a), math.sin(a)
        p1 = (hub[0] + ca * 1.4, hub[1] + sa * 1.4); p2 = (hub[0] + ca * 10.4, hub[1] + sa * 10.4)
        nx, ny = -sa * 2.8, ca * 2.8
        c.fill(poly([p1, p2, (p2[0] + nx, p2[1] + ny), (p1[0] + nx * .6, p1[1] + ny * .6)]), 'yellowB')
        c.fill(poly([p1, p2, (p2[0] + nx * .4, p2[1] + ny * .4), (p1[0] + nx * .3, p1[1] + ny * .3)]), 'yellow')   # spar
        for t in (0.45, 0.75):                                                          # lattice
            q = (p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t)
            c.fill(poly([q, (q[0] + nx, q[1] + ny), (q[0] + nx + ca * .9, q[1] + ny + sa * .9), (q[0] + ca * .9, q[1] + sa * .9)]), 'yellow')
    c.fill(ell(14, 11, 1, 1), 'gray')
    c.fill(ell(4, 4, 2.4, 1), 'whiteB'); c.fill(ell(24, 6, 2.6, 1), 'whiteB')          # clouds
    return c

def dragon():
    c = Canvas(30, 24)
    c.fill(poly([(12, 9), (16, 1), (22, 0.6), (26, 3), (21, 5), (19, 9)]), 'green')    # wing
    c.fill(both(poly([(12, 9), (16, 1), (22, 0.6), (26, 3), (21, 5), (19, 9)]), lambda x, y: int(x) % 3 == 0), 'greenB')   # wing ribs
    c.fill(ell(15, 13.4, 6.4, 3.8), 'green')                                           # body
    c.fill(ell(14, 15, 4, 2), 'yellowB')                                               # belly
    c.fill(poly([(20, 13), (28, 17), (29.6, 15), (26, 20), (19.6, 16)]), 'green')      # tail
    c.fill(poly([(28, 17), (29.6, 15), (30, 18.6)]), 'redB')                           # tail spade
    c.fill(poly([(9.4, 12.4), (7, 7), (9.6, 6.4), (11.4, 11)]), 'green')              # neck
    c.fill(ell(7.4, 6, 3.2, 2.4), 'green')                                             # head
    c.fill(poly([(4.6, 5), (1, 6.2), (4.6, 8)]), 'green')                              # snout
    c.px([(7, 3), (8, 2), (9, 3)], 'yellowB')                                          # horns
    c.px([(7, 5)], 'redB'); c.px([(1, 6), (2, 6)], 'greenB')                           # eye, nostril
    c.fill(poly([(1, 7), (-3, 5), (-2, 9)]), 'redB')                                   # a little puff of fire
    c.px([(0, 6), (0, 8)], 'yellowB')
    for x in range(11, 21, 2):
        c.px([(x, 9)], 'redB')                                                          # back spines
    c.fill(rect(11, 16.4, 12.2, 20), 'green'); c.fill(rect(17, 16.4, 18.2, 20), 'green')   # legs
    c.fill(rect(0, 20.4, 30, 21.6), 'gray')
    return c

def sea_turtle_2():
    c = Canvas(34, 24)
    c.fill(rect(0, 0, 34, 24), 'blue')                                                 # open water
    for x0 in (4, 13, 24):                                                             # light rays from the surface
        c.fill(poly([(x0, 0), (x0 + 3, 0), (x0 + 8, 24), (x0 + 6, 24)]), 'blueB')
    for x, y in ((29, 4), (30, 2), (31, 5), (3, 19)):
        c.px([(x, y)], 'cyanB')                                                        # bubbles
    c.fill(poly([(11.6, 12.6), (5.4, 20.6), (8, 21.4), (15.6, 14)]), 'green')          # long front flipper, sweeping back
    c.fill(both(poly([(11.6, 12.6), (5.4, 20.6), (8, 21.4), (15.6, 14)]), lambda x, y: int(x - y) % 3 == 0), 'greenB')   # flipper scales
    c.fill(poly([(23, 13), (28, 16.6), (26.4, 17.6), (22, 14.6)]), 'green')            # rear flipper
    c.fill(poly([(25, 12.2), (29.4, 12.8), (25, 13.8)]), 'green')                      # tail
    dome = both(ell(18, 13, 8.6, 7), rect(0, 0, 40, 13.6))
    c.fill(dome, 'yellow')                                                             # high domed carapace
    for (cx, cy) in ((15, 9.4), (18.6, 7.6), (22, 9.4), (13, 12.4), (16.8, 11.8), (20.6, 11.8), (24, 12.4)):
        c.fill(both(dome, ell(cx, cy, 1.5, 1.1)), 'yellowB')                           # scutes
    c.fill(both(dome, lambda x, y: int(y) == 13), 'yellowB')                          # plastron edge
    c.fill(poly([(10.6, 12), (8, 11.2), (8, 13.6), (10.8, 14)]), 'greenB')             # neck
    c.fill(ell(6.4, 12, 2.6, 2), 'greenB')                                             # head
    c.fill(both(ell(6.4, 12, 2.6, 2), lambda x, y: (int(x) + int(y)) % 2 == 0 and x > 6), 'green')   # head scales
    c.px([(5, 11)], 'black'); c.px([(4, 13)], 'green')                                # eye, beak line
    return c

def heron_sun():
    c = Canvas(42, 32)
    sun = ell(21, 14, 13.4, 13.4)
    c.fill(sun, 'redB'); c.fill(ell(21, 14, 10.8, 10.8), 'yellowB')                     # big setting sun
    c.fill(rect(0, 25, 42, 32), 'blue')                                                # water
    for y, x0, x1, t in ((26, 11, 31, 'redB'), (27.6, 13, 29, 'yellowB'), (29.2, 15, 27, 'redB'), (30.8, 18, 24, 'yellowB')):
        c.fill(rect(x0, y, x1, y + .8), t)                                             # the sun's reflection
    c.fill(rect(0, 24.4, 42, 25.2), 'redB')                                            # horizon glow
    # the heron in flight, drawn small enough to sit inside the sun: black
    # where it crosses the disk, deep blue beyond it (the trailing legs)
    k, ox, oy = 0.8, 5.6, 5.4
    P = lambda pts: poly([(ox + x * k, oy + y * k) for x, y in pts])
    E = lambda cx, cy, rx, ry, a=0: ell(ox + cx * k, oy + cy * k, rx * k, ry * k, a)
    parts = [P([(13.4, 10.4), (16, 6), (21, 2.4), (28, 0.4), (35, 0.6), (30, 3.4), (24, 7), (21, 10.6)]),
             P([(15, 12.4), (19, 16.6), (26, 18.4), (29, 17.4), (22, 12.2)]),
             E(17.4, 11.6, 7, 2.2, -3), P([(23.6, 10.6), (27, 11.4), (23.6, 12.6)]),
             E(11.4, 12.2, 1.8, 1.6), E(9.6, 10.4, 2, 1.7),
             P([(8, 10), (1.4, 11), (8, 11.4)]),
             P([(24, 12.2), (38, 12.2), (38, 13.2), (24, 13.2)]), P([(24, 14.2), (37, 14.2), (37, 15.2), (24, 15.2)])]
    for part in parts:
        c.fill(part, 'blue')
        c.fill(both(part, sun), 'black')
    return c

def raven_2():
    c = Canvas(30, 26)
    c.fill(poly([(18.6, 15.4), (29.6, 20), (28.4, 22.6), (18, 19)]), 'black')         # wedge-shaped tail
    c.fill(both(poly([(18.6, 15.4), (29.6, 20), (28.4, 22.6), (18, 19)]), lambda x, y: int(x) % 3 == 0), 'blue')
    c.fill(ell(14.4, 14, 7.4, 5.2, 18), 'black')                                      # body
    wing = ell(17, 13.2, 6.6, 3.8, 22)
    c.fill(wing, 'blue')                                                               # glossy wing
    for k in range(4):
        c.fill(both(wing, lambda x, y, k=k: int(y - (x - 12) * 0.4) == 11 + k), 'blueB')   # feather rows catching the light
    c.fill(ell(8.4, 8, 3.8, 3.4), 'black')                                            # head
    c.fill(both(ell(8.4, 8, 3.8, 3.4), rect(0, 0, 40, 6.2)), 'blueB')                 # sheen on the crown
    c.fill(poly([(5.4, 6.4), (0.4, 8.2), (0.8, 9.6), (5.6, 10.4)]), 'black')          # heavy beak
    c.fill(poly([(5.4, 6.4), (0.4, 8.2), (5.4, 7.6)]), 'gray')                        # beak ridge
    c.px([(0, 9)], 'gray')
    for x, y in ((6, 11), (7, 12), (9, 13), (10, 12)):
        c.px([(x, y)], 'black')                                                         # shaggy throat hackles
    c.outline('gray', skip=('yellow', 'blueB'))                                         # silhouette edge
    c.px([(7, 7)], 'whiteB')                                                            # eye glint
    c.fill(rect(11.2, 18.6, 12, 21), 'gray'); c.fill(rect(14.4, 18.6, 15.2, 21), 'gray')   # legs
    c.px([(10, 21), (13, 21), (16, 21)], 'gray')                                        # toes
    c.fill(rect(0, 21.4, 24, 22.8), 'yellow')                                           # branch
    c.px([(4, 23), (20, 23), (21, 24)], 'yellow')
    return c

def _fish(c, cx, cy, length, ang, base, spots, spot_rule):
    """A koi seen from above, nose at angle `ang` (degrees)."""
    a = math.radians(ang); ca, sa = math.cos(a), math.sin(a)
    to = lambda u, v: (cx + u * ca - v * sa, cy + u * sa + v * ca)          # fish space → canvas
    L = length / 2
    body = ell(cx, cy, L, length / 6.4, ang)
    tail = poly([to(-L * 0.8, 0), to(-L * 1.5, -L * 0.45), to(-L * 1.25, 0), to(-L * 1.5, L * 0.45)])
    fins = [poly([to(L * 0.25, L * 0.12), to(-L * 0.05, L * 0.55), to(L * 0.05, L * 0.1)]),
            poly([to(L * 0.25, -L * 0.12), to(-L * 0.05, -L * 0.55), to(L * 0.05, -L * 0.1)])]
    for f in fins + [tail]:
        c.fill(f, spots if base == 'whiteB' else base)
    c.fill(tail, 'whiteB' if base != 'whiteB' else 'redB', only=None) if False else None
    c.fill(body, base)
    c.fill(both(body, lambda x, y: spot_rule((x - cx) * ca + (y - cy) * sa)), spots)   # pattern along the body
    nose = to(L * 0.82, 0)
    c.px([(int(to(L * 0.6, L * 0.2)[0]), int(to(L * 0.6, L * 0.2)[1])), (int(to(L * 0.6, -L * 0.2)[0]), int(to(L * 0.6, -L * 0.2)[1]))], 'black')   # eyes

def koi_2():
    c = Canvas(34, 26)
    c.fill(ell(17, 13, 17, 13), 'blue')                                               # pond
    for r in (6, 10.4):
        c.fill(minus(ell(17, 13, r, r * 0.76), ell(17, 13, r - 0.8, r * 0.76 - 0.8)), 'blueB')   # ripple rings
    for (cx, cy, rr) in ((6, 7, 3), (28, 19, 3.4), (26, 5, 2.2)):
        c.fill(minus(ell(cx, cy, rr, rr * 0.8), poly([(cx, cy), (cx + rr, cy - rr), (cx + rr, cy)])), 'green')   # lily pads with a notch
        c.fill(ell(cx - .6, cy - .6, rr * .45, rr * .35), 'greenB')
    c.fill(ell(6.6, 6.2, 1.2, 1), 'magentaB'); c.px([(6, 6)], 'yellowB')               # lotus flower
    _fish(c, 13.4, 10.6, 14, -20, 'whiteB', 'redB', lambda u: -3.4 < u < -0.4 or 1.4 < u < 3.6)     # kohaku: white with red
    _fish(c, 21, 17.4, 12.4, 160, 'yellowB', 'yellow', lambda u: -2.6 < u < -0.8 or 1.2 < u < 2.4)      # gold ogon
    for x, y in ((3, 16), (30, 10), (14, 23)):
        c.px([(x, y)], 'cyan')
    return c

def heron_sun_2():
    """Crossing a sun half-sunk into the sea, under a banded dusk sky."""
    c = Canvas(42, 30)
    for y0, t in ((0, 'magenta'), (5, 'red'), (10, 'redB')):                           # dusk bands
        c.fill(rect(0, y0, 42, y0 + 5), t)
    sun = ell(21, 17, 12, 12)
    c.fill(sun, 'yellow'); c.fill(ell(21, 17, 9.6, 9.6), 'yellowB')
    c.fill(rect(0, 17, 42, 30), 'blue')                                                # the sea swallows the lower half
    for y, x0, x1, t in ((18.4, 10, 32, 'yellowB'), (20.2, 12, 30, 'yellow'), (22, 14, 28, 'yellowB'), (24, 17, 25, 'yellow'), (26, 19, 23, 'yellowB')):
        c.fill(rect(x0, y, x1, y + .9), t)
    k, ox, oy = 0.78, 6.4, 3.6
    P = lambda pts: poly([(ox + x * k, oy + y * k) for x, y in pts])
    E = lambda cx, cy, rx, ry, a=0: ell(ox + cx * k, oy + cy * k, rx * k, ry * k, a)
    parts = [P([(13.4, 10.4), (16, 6), (21, 2.4), (28, 0.4), (35, 0.6), (30, 3.4), (24, 7), (21, 10.6)]),  # raised wing
             P([(15, 12.4), (19, 16.6), (26, 18.4), (29, 17.4), (22, 12.2)]),                               # lower wing
             E(17.4, 11.6, 7, 2.2, -3), P([(23.6, 10.6), (27, 11.4), (23.6, 12.6)]),
             E(11.4, 12.2, 1.8, 1.6), E(9.6, 10.4, 2, 1.7), P([(8, 10), (1.4, 11), (8, 11.4)]),
             P([(24, 12.4), (38, 12.8), (38, 13.6), (24, 13.2)]), P([(24, 14.4), (37, 15), (37, 15.8), (24, 15.2)])]
    for part in parts:
        c.fill(part, 'gray')
        c.fill(both(part, minus(sun, rect(0, 17, 42, 30))), 'black')
    return c

def heron_sun_3():
    """A pale full sun low over still water, the heron gliding with its reflection below."""
    c = Canvas(42, 32)
    sun = ell(21, 11, 10, 10)
    c.fill(sun, 'yellowB'); c.fill(ell(21, 11, 7, 7), 'whiteB')
    for x, y in ((4, 3), (36, 5), (9, 12), (33, 14)):
        c.px([(x, y)], 'whiteB')                                                        # first stars
    c.px([(33, 3), (34, 2), (35, 3), (37, 7), (38, 6), (39, 7)], 'gray')               # two far-off birds
    c.fill(rect(0, 20, 42, 32), 'blue')                                                # still water
    c.fill(both(ell(21, 29, 10, 10), rect(0, 20, 42, 32)), 'blueB')                    # the sun's soft reflection
    k, ox, oy = 0.72, 7.4, 3.6
    shapes = [[(13.4, 10.4), (16, 6), (21, 2.4), (28, 0.4), (35, 0.6), (30, 3.4), (24, 7), (21, 10.6)],
              [(15, 12.4), (19, 16.6), (26, 18.4), (29, 17.4), (22, 12.2)],
              [(23.6, 10.6), (27, 11.4), (23.6, 12.6)], [(8, 10), (1.4, 11), (8, 11.4)],
              [(24, 12.2), (38, 12.2), (38, 13.2), (24, 13.2)], [(24, 14.2), (37, 14.2), (37, 15.2), (24, 15.2)]]
    ells = [(17.4, 11.6, 7, 2.2, -3), (11.4, 12.2, 1.8, 1.6, 0), (9.6, 10.4, 2, 1.7, 0)]
    for flip in (False, True):                                                          # the bird, then its reflection
        Y = (lambda y: 40.4 - (oy + y * k)) if flip else (lambda y: oy + y * k)
        parts = [poly([(ox + x * k, Y(y)) for x, y in pts]) for pts in shapes]
        parts += [ell(ox + cx * k, Y(cy), rx * k, ry * k, -a if flip else a) for cx, cy, rx, ry, a in ells]
        for part in parts:
            if flip:
                c.fill(both(both(part, rect(0, 21, 42, 32)), lambda x, y: int(y) % 2 == 0 and int(x) % 3 != 0), 'gray')   # rippled reflection
            else:
                c.fill(part, 'gray'); c.fill(both(part, sun), 'black')
    return c

HERON = dict(   # the flying heron (raised-wing pose) as shapes, in its own coordinates
    polys=[[(13.4, 10.4), (16, 6), (21, 2.4), (28, 0.4), (35, 0.6), (30, 3.4), (24, 7), (21, 10.6)],
           [(15, 12.4), (19, 16.6), (26, 18.4), (29, 17.4), (22, 12.2)],
           [(23.6, 10.6), (27, 11.4), (23.6, 12.6)], [(8, 10), (1.4, 11), (8, 11.4)],
           [(24, 12.4), (38, 12.8), (38, 13.6), (24, 13.2)], [(24, 14.4), (37, 15), (37, 15.8), (24, 15.2)]],
    ells=[(17.4, 11.6, 7, 2.2, -3), (11.4, 12.2, 1.8, 1.6, 0), (9.6, 10.4, 2, 1.7, 0)])

# The raised wing, and a mid-beat version (tip lowered to about body level).
WING_MID = [(13.4, 10.4), (17, 8.4), (23, 7), (30, 6.6), (36, 8), (30, 9.4), (24, 10), (21, 10.8)]

def heron_parts(k, ox, oy, wing='up'):
    polys = HERON['polys'] if wing == 'up' else [WING_MID] + HERON['polys'][1:]
    parts = [poly([(ox + x * k, oy + y * k) for x, y in pts]) for pts in polys]
    return parts + [ell(ox + cx * k, oy + cy * k, rx * k, ry * k, a) for cx, cy, rx, ry, a in HERON['ells']]

def coopers_hawk_2():
    c = Canvas(28, 36)
    tail = poly([(12.6, 20), (17, 19.6), (19.4, 35), (15.6, 35.6), (13.4, 35)])
    c.fill(tail, 'blue')
    for y in (24.4, 28, 31.6):
        c.fill(both(tail, rect(0, y, 40, y + 1.2)), 'gray')                           # three dark tail bands
    c.fill(both(tail, rect(0, 34.2, 40, 36)), 'whiteB')                               # white tip
    back = ell(14, 14.6, 5.6, 8, -10)
    c.fill(back, 'blue')
    chest = ell(11.2, 16, 3.6, 6.6, -6)
    c.fill(chest, 'whiteB')
    for y in range(11, 23, 2):                                                         # fine rufous barring across the chest
        c.fill(both(chest, lambda x, yy, y=y: int(yy) == y and (int(x) + y // 2) % 3 != 0), 'redB')
    wing = ell(16.6, 15, 3.6, 7.4, -12)
    c.fill(wing, 'blue')
    c.fill(both(wing, lambda x, y: x > 18.2), 'blueB')                                 # light catching the wing edge
    for k in range(4):
        c.fill(both(wing, lambda x, y, k=k: int(y) == 16 + 2 * k and x < 18), 'gray')  # feather tiers
    head = ell(10, 7, 4.4, 4)
    c.fill(head, 'blue')                                                               # blue-gray nape
    c.fill(both(head, lambda x, y: y < 6.2), 'gray')                                   # dark cap
    c.fill(both(head, lambda x, y: 6 < x < 11 and 8 < y < 11), 'redB')                 # rufous cheek
    c.fill(poly([(6.4, 6), (2.6, 6.8), (1.8, 9.4), (3, 8.6), (6.6, 8.8)]), 'gray')     # hooked beak
    c.px([(2, 9)], 'gray'); c.px([(6, 6)], 'yellowB')                                  # hook, yellow cere
    c.px([(7, 6), (8, 6), (7, 7)], 'redB'); c.px([(8, 7)], 'black')                   # red eye with pupil
    c.fill(rect(11, 22, 11.8, 26.4), 'yellowB'); c.fill(rect(13.8, 22, 14.6, 26.4), 'yellowB')   # yellow legs
    c.px([(10, 26), (12, 26), (13, 26), (15, 26)], 'gray')                             # talons
    c.fill(rect(0, 26.4, 24, 27.8), 'yellow')                                          # branch
    c.fill(ell(2.4, 25.2, 2, 1.1, -20), 'green'); c.fill(ell(22, 28.6, 2, 1.1, 20), 'green')   # leaves
    return c

def raven_3():
    c = Canvas(32, 30)
    c.fill(poly([(20, 17), (31.6, 22.6), (30.8, 25), (26, 24), (19, 21)]), 'black')    # long wedge tail
    c.fill(ell(15.4, 15.4, 8, 5.6, 20), 'black')                                       # body
    wing = ell(18, 14.6, 7.2, 4, 24)
    c.fill(wing, 'black')
    for k in range(5):
        c.fill(both(wing, lambda x, y, k=k: int(y - (x - 12) * 0.45) == 11 + k and x > 13), 'blue')   # glossy feather rows
    c.fill(both(wing, lambda x, y: int(y - (x - 12) * 0.45) == 12 and x > 15), 'magenta')   # purple gloss
    c.fill(ell(9, 8.6, 4.2, 3.8), 'black')                                             # head, flat crown
    c.fill(both(ell(9, 8.6, 4.2, 3.8), lambda x, y: y < 6.4 and x > 7), 'blue')        # sheen on the crown
    c.fill(poly([(5.8, 6.4), (2, 6.8), (0.2, 8.4), (0.6, 9.4), (2.4, 9), (6, 10.8)]), 'black')   # thick, curved beak
    c.fill(poly([(5.8, 6.4), (2, 6.8), (0.2, 8.4), (5.8, 7.6)]), 'gray')               # beak ridge
    for x, y in ((6, 11), (7, 12), (8, 13), (9, 12), (10, 13), (11, 12)):
        c.px([(x, y)], 'black')                                                         # shaggy throat hackles
    c.fill(rect(11.8, 20, 12.8, 23.4), 'gray'); c.fill(rect(15.4, 20, 16.4, 23.4), 'gray')   # legs
    c.px([(11, 23), (14, 23), (17, 23)], 'gray')
    c.outline('gray', skip=('gray', 'yellow', 'blue', 'magenta'))                     # pale edge so the black shape shows
    c.px([(7, 7)], 'whiteB')                                                            # eye glint
    post = rect(8, 23.4, 20, 30)
    c.fill(post, 'yellow')                                                             # weathered fence post
    c.fill(both(post, lambda x, y: int(x) in (10, 14, 17) and int(y) % 3 != 0), 'red') # wood grain
    c.fill(rect(7.4, 23.4, 20.6, 24.2), 'yellowB')                                      # sunlit top edge
    return c

def heron_sun_4():
    """Over a marsh: reeds and cattails in silhouette in front of the sun."""
    c = Canvas(42, 32)
    sun = ell(20, 14, 12.4, 12.4)
    c.fill(sun, 'redB'); c.fill(ell(20, 14, 10, 10), 'yellowB')
    c.fill(rect(0, 26, 42, 32), 'blue')                                                # marsh water
    c.fill(rect(10, 27, 30, 27.8), 'yellowB'); c.fill(rect(13, 29.4, 27, 30.2), 'redB')
    for x0, h, cat in ((2, 12, True), (4, 9, False), (6, 14, True), (30, 11, False), (33, 15, True), (35, 10, False), (38, 13, True), (8, 7, False)):
        top = 27 - h
        c.fill(rect(x0, top, x0 + 0.8, 27), 'black')                                   # reed stems
        if cat: c.fill(ell(x0 + 0.4, top + 1.6, 0.9, 1.8), 'black')                    # cattail heads
        c.fill(poly([(x0 + 0.4, 27), (x0 + 3, top + 4), (x0 + 1.4, 27)]), 'black')     # leaning blades
    for part in heron_parts(0.72, 5.6, 5.2):
        c.fill(part, 'gray'); c.fill(both(part, sun), 'black')
    return c

def heron_sun_5():
    """High over a mountain ridge, the sun sitting between the peaks."""
    c = Canvas(42, 32)
    for y0, t in ((0, 'blue'), (8, 'magenta'), (15, 'red')):                           # evening sky bands
        c.fill(rect(0, y0, 42, y0 + 8), t)
    sun = ell(22, 22, 9, 9)
    c.fill(sun, 'redB'); c.fill(ell(22, 22, 7, 7), 'yellowB')
    c.fill(poly([(0, 32), (0, 22), (7, 15), (12, 20), (17, 17), (22, 25), (27, 18), (33, 13), (42, 21), (42, 32)]), 'gray')   # far ridge
    c.fill(poly([(0, 32), (0, 27), (10, 22), (18, 27), (26, 24), (34, 28), (42, 25), (42, 32)]), 'black')                   # near ridge
    c.fill(poly([(31, 14.4), (33, 13), (35, 15)]), 'whiteB')                           # snow on the high peak
    for part in heron_parts(0.62, 8, 1.4):
        c.fill(part, 'black')                                                           # heron high in the sky
    return c

def whale_breach():
    c = Canvas(36, 30)
    c.fill(ell(30, 5, 3, 3), 'yellowB')                                                # sun
    ang = -58                                                                          # leaping steeply up and to the left
    a = math.radians(ang); ca, sa = math.cos(a), math.sin(a)
    cx, cy = 15, 14
    body = ell(cx, cy, 11, 3.8, ang)
    c.fill(body, 'blue')
    side = lambda x, y: (-(x - cx) * sa + (y - cy) * ca)                              # distance across the body
    along = lambda x, y: ((x - cx) * ca + (y - cy) * sa)                              # distance along it
    c.fill(both(body, lambda x, y: side(x, y) > 0.6), 'whiteB')                        # pale grooved belly
    c.fill(both(body, lambda x, y: side(x, y) > 0.6 and int(along(x, y) * 1.3) % 2 == 0), 'gray')   # throat grooves
    head = (cx + 10 * ca, cy + 10 * sa)
    c.px([(int(head[0] + 1.6), int(head[1] + 2.4))], 'black')                          # eye
    for t in (7, 8.4, 9.6):
        c.px([(int(cx + t * ca - 1.4 * sa * -1), int(cy + t * sa - 1.4 * ca))], 'blueB')   # knobs on the head
    fin_root = (cx + 3 * ca, cy + 3 * sa)                                               # long pectoral fin flung out
    c.fill(poly([(fin_root[0], fin_root[1] - 1), (fin_root[0] + 11, fin_root[1] + 2.6), (fin_root[0] + 10.4, fin_root[1] + 4.2),
                 (fin_root[0] + 0.4, fin_root[1] + 2)]), 'whiteB')
    c.fill(both(poly([(fin_root[0], fin_root[1] - 1), (fin_root[0] + 11, fin_root[1] + 2.6), (fin_root[0] + 10.4, fin_root[1] + 4.2),
                      (fin_root[0] + 0.4, fin_root[1] + 2)]), lambda x, y: y > fin_root[1] + 1.8 + (x - fin_root[0]) * 0.24), 'gray')
    c.fill(rect(0, 23, 36, 30), 'blue')                                                # sea
    for (ex, ey, rx, ry) in ((14, 23, 6, 2.2), (8, 22.4, 3, 2), (21, 22.6, 3.4, 1.8), (5, 20.6, 1.2, 1.2), (24, 20, 1.2, 1.2), (11, 19.6, 1, 1)):
        c.fill(ell(ex, ey, rx, ry), 'whiteB')                                          # splash
    for x, y in ((2, 18), (27, 17), (29, 19), (6, 16)):
        c.px([(x, y)], 'cyanB')                                                         # flying spray
    for y, x0, x1 in ((26, 2, 10), (27.6, 20, 32), (29, 6, 14)):
        c.fill(rect(x0, y, x1, y + .6), 'cyan')
    return c

def coopers_hawk_3():
    c = Canvas(28, 38)
    tail = poly([(12.8, 20.4), (17.2, 20), (19.6, 36.4), (17.4, 37.4), (15, 37.4), (13, 36.4)])   # long, rounded tail
    c.fill(tail, 'blue')
    for y in (24.6, 28.4, 32.2):
        c.fill(both(tail, rect(0, y, 40, y + 1.4)), 'gray')                           # dark bands
    c.fill(both(tail, rect(0, 35.8, 40, 38)), 'whiteB')                               # white tip
    back = ell(14.2, 14.8, 5.6, 8.2, -10)
    c.fill(back, 'blue')
    chest = ell(11.4, 16.2, 3.8, 6.8, -6)
    c.fill(chest, 'whiteB')
    for y in range(12, 23, 2):                                                         # fine rufous bars with a gentle wave
        c.fill(both(chest, lambda x, yy, y=y: int(yy) == y + (1 if int(x) % 6 >= 3 else 0) and int(x) % 6 != 2), 'redB')
    c.fill(both(chest, lambda x, y: y < 11.6), 'whiteB')                               # clean upper breast
    for x in (10, 12):
        c.px([(x, 10), (x, 11)], 'red')                                                # streaked throat
    wing = ell(16.8, 15.4, 3.8, 7.6, -12)
    c.fill(wing, 'blue')
    for k in range(4):                                                                  # scalloped feather edges
        y0 = 13 + 3 * k
        c.fill(both(wing, lambda x, y, y0=y0: int(y) == y0 + ((int(x) % 4) // 2) and x < 19), 'blueB')
    c.fill(both(wing, lambda x, y: x > 19.2), 'gray')                                   # shadowed primaries
    head = ell(10.2, 7.2, 4.6, 4.1)
    c.fill(head, 'blue')                                                                # blue-gray nape
    c.fill(both(head, lambda x, y: y < 6.4), 'gray')                                    # dark cap
    c.fill(rect(6.6, 6, 10.6, 6.9), 'gray')                                             # heavy brow over the eye
    c.fill(both(head, lambda x, y: 5.6 < x < 11.4 and 8.4 < y < 11.4), 'redB')          # rufous cheek
    c.fill(poly([(6.4, 6.2), (2.8, 6.8), (1.8, 9.6), (3.2, 8.8), (6.6, 9)]), 'gray')    # hooked beak
    c.px([(2, 9)], 'gray'); c.px([(6, 6), (6, 7)], 'yellowB')                           # hook, yellow cere
    c.px([(7, 7), (8, 7)], 'redB'); c.px([(8, 8)], 'black')                            # red eye with pupil
    c.fill(rect(11.2, 22.4, 12, 27), 'yellowB'); c.fill(rect(14, 22.4, 14.8, 27), 'yellowB')   # yellow legs
    c.px([(10, 27), (12, 27), (13, 27), (15, 27)], 'gray')                              # talons
    c.fill(rect(0, 27, 24, 28.4), 'yellow')                                             # branch
    c.fill(ell(2.4, 25.8, 2, 1.1, -20), 'green'); c.fill(ell(22, 29.2, 2, 1.1, 20), 'green')   # leaves
    return c

def heron_sun_vignette(dy=0, wing='up', shimmer=0):
    """Heron scene 1 as a vignette: the sun, the heron, a short tapering strip of water.
    dy/wing/shimmer give the animation frames (a glide bob, a wing beat, and the
    reflection's shimmer)."""
    c = Canvas(42, 30)
    sun = ell(21, 13, 11.4, 11.4)
    c.fill(sun, 'redB'); c.fill(ell(21, 13, 9, 9), 'yellowB')
    water = ell(21, 25.6, 17, 3.2)                                                     # tapers to points at both ends
    c.fill(minus(water, rect(0, 0, 42, 24.2)), 'blue')
    c.fill(both(minus(water, rect(0, 0, 42, 24.2)), lambda x, y: int(y) == 24), 'blueB')   # waterline catching light
    for n, (y, half, t) in enumerate(((25, 7, 'redB'), (26.4, 5, 'yellowB'), (27.6, 3, 'redB'))):
        shift = (1 if n % 2 == 0 else -1) * shimmer                                    # the reflection shimmers side to side
        c.fill(rect(21 - half + shift, y, 21 + half + shift, y + 0.7), t)
    for part in heron_parts(0.8, 5.6, 4.4 + dy, wing):
        c.fill(part, 'gray'); c.fill(both(part, sun), 'black')
    return c

def heron_sun_bare():
    """Heron scene 1 with no background: just the sun disk and the heron."""
    c = Canvas(42, 26)
    sun = ell(21, 13, 11.4, 11.4)
    c.fill(sun, 'redB'); c.fill(ell(21, 13, 9, 9), 'yellowB')
    for part in heron_parts(0.8, 5.6, 4.4):
        c.fill(part, 'gray'); c.fill(both(part, sun), 'black')
    return c

def pool(cx, cy, half_w, depth):
    """A strip of water that tapers to points at both ends (top edge at cy)."""
    return minus(ell(cx, cy, half_w, depth), rect(-99, -99, 999, cy - 0.01))

def lighthouse_v():
    c = Canvas(28, 30)
    c.fill(poly([(12, 5.4), (0, 1), (0, 6)]), 'yellowB'); c.fill(poly([(16, 5.4), (28, 2), (28, 7)]), 'yellowB')   # beams
    c.fill(poly([(12, 5.4), (0, 1), (0, 2.6)]), 'yellow'); c.fill(poly([(16, 5.4), (28, 2), (28, 3.6)]), 'yellow')
    for x, y in ((4, 11), (23, 12), (7, 17), (21, 19)):
        c.px([(x, y)], 'whiteB')                                                        # a few stars close by
    c.fill(pool(14, 26.4, 14, 3.4), 'blue')                                            # sea, tapering away
    c.fill(both(pool(14, 26.4, 14, 3.4), lambda x, y: int(y) == 26 and int(x) % 4 == 1), 'cyan')   # wave glints
    c.fill(poly([(7, 28.6), (9, 24), (19, 24), (21, 28.6)]), 'gray')                   # rocks
    c.fill(poly([(11, 4), (14, 1), (17, 4)]), 'red')
    c.fill(rect(11.4, 4, 16.6, 7), 'yellowB'); c.fill(rect(12.4, 4.6, 15.6, 6.4), 'whiteB')
    c.fill(rect(10.6, 7, 17.4, 8), 'gray')
    tower = poly([(11.4, 8), (16.6, 8), (18, 24), (10, 24)])
    c.fill(tower, 'whiteB')
    for y in (11, 17):
        c.fill(both(tower, rect(0, y, 40, y + 3)), 'redB')
    c.px([(14, 13), (14, 19)], 'gray')
    return c

def whale_tail_v():
    c = Canvas(30, 20)
    c.fill(ell(24, 4.6, 3.4, 3.4), 'redB'); c.fill(both(ell(24, 4.6, 3.4, 3.4), rect(0, 4.8, 40, 40)), 'yellowB')
    c.fill(pool(14, 13, 14, 5.6), 'blue')                                               # water tapering to points
    c.fill(poly([(11, 13.4), (11.8, 8), (14.2, 8), (15, 13.4)]), 'blue')
    c.fill(ell(8.4, 6, 5.6, 2, 22), 'blue'); c.fill(ell(17.6, 6, 5.6, 2, -22), 'blue'); c.fill(ell(13, 8.4, 2, 1.2), 'blue')
    c.fill(both(ell(8.4, 6, 5.6, 2, 22), lambda x, y: y > 6.6), 'blueB'); c.fill(both(ell(17.6, 6, 5.6, 2, -22), lambda x, y: y > 6.6), 'blueB')
    for x, y in ((4, 6), (5, 8), (21, 8), (22, 6), (12, 10), (14, 11)):
        c.px([(x, y)], 'cyanB')
    c.fill(rect(8, 13, 18, 13.8), 'whiteB')                                            # splash ring
    for y, half in ((15, 5), (16.6, 3.4)):
        c.fill(rect(24 - half, y, 24 + half * 0.4, y + .7), 'yellowB' if half > 4 else 'yellow')   # sun path, narrowing
    return c

def whale_breach_v():
    c = whale_breach()
    for y in range(23, 30):                                                             # trim the sea to a tapering pool
        for x in range(c.w):
            if not pool(18, 23, 18, 7)(x + .5, y + .5) and c.g[y][x] in ('blue', 'cyan'):
                c.g[y][x] = None
    return c

def heron_sun_2_v():
    c = Canvas(42, 30)
    glow = ell(21, 16, 19, 13)                                                          # the dusk colors only around the sun
    for y0, t in ((0, 'magenta'), (6, 'red'), (11, 'redB')):
        c.fill(both(rect(0, y0, 42, y0 + 6), both(glow, rect(0, 0, 42, 17))), t)
    sun = ell(21, 17, 11, 11)
    c.fill(both(sun, rect(0, 0, 42, 17)), 'yellow'); c.fill(both(ell(21, 17, 8.8, 8.8), rect(0, 0, 42, 17)), 'yellowB')
    c.fill(pool(21, 17, 20, 11), 'blue')
    for y, half, t in ((18.4, 11, 'yellowB'), (20.2, 9, 'yellow'), (22, 7, 'yellowB'), (24, 4.6, 'yellow'), (26, 2.4, 'yellowB')):
        c.fill(rect(21 - half, y, 21 + half, y + .9), t)
    for part in heron_parts(0.78, 6.4, 3.6):
        c.fill(both(part, rect(0, 0, 42, 17)), 'gray'); c.fill(both(part, both(sun, rect(0, 0, 42, 17))), 'black')
    return c

def heron_sun_3_v():
    c = heron_sun_3()
    for y in range(20, 32):
        for x in range(c.w):
            if not pool(21, 20, 21, 12)(x + .5, y + .5) and c.g[y][x] in ('blue', 'blueB', 'gray'):
                c.g[y][x] = None
    return c

def heron_sun_4_v():
    c = heron_sun_4()
    for y in range(26, 32):
        for x in range(c.w):
            if not pool(21, 26, 21, 6)(x + .5, y + .5) and c.g[y][x] in ('blue',):
                c.g[y][x] = None
    return c

def heron_sun_5_v():
    c = heron_sun_5()
    window = ell(21, 16.6, 20.6, 15)                                                     # the whole scene in an oval window
    for y in range(c.h):
        for x in range(c.w):
            if not window(x + .5, y + .5) and c.g[y][x] not in (None, 'black'):
                c.g[y][x] = None
            elif not window(x + .5, y + .5) and y > 20:
                c.g[y][x] = None                                                          # near ridge ends with the oval too
    return c

FIGURES = {'coopers_hawk': coopers_hawk, 'hawk_flight': hawk_flight, 'owl': owl, 'raven': raven, 'heron': heron, 'robin': robin, 'cardinal': cardinal, 'hummingbird': hummingbird, 'fox': fox, 'mountain_lake': mountain_lake, 'kingfisher': kingfisher, 'puffin': puffin, 'blue_jay': blue_jay, 'loon': loon, 'lighthouse': lighthouse, 'moon_pines': moon_pines, 'journal': journal, 'sailboat': sailboat, 'heron_flight': heron_flight, 'tiger': tiger, 'lighthouse_cliff': lighthouse_cliff, 'coffee': coffee, 'sleeping_cat': sleeping_cat, 'chess_knight': chess_knight, 'penguin': penguin, 'flamingo': flamingo, 'wolf': wolf, 'whale_tail': whale_tail, 'campfire': campfire, 'balloon': balloon, 'eagle': eagle, 'koi': koi, 'stag': stag, 'sea_turtle': sea_turtle, 'bonsai': bonsai, 'octopus': octopus, 'panda': panda, 'hedgehog': hedgehog, 'peacock': peacock, 'rocket': rocket, 'windmill': windmill, 'dragon': dragon, 'sea_turtle_2': sea_turtle_2, 'heron_sun': heron_sun, 'raven_2': raven_2, 'koi_2': koi_2, 'heron_sun_2': heron_sun_2, 'heron_sun_3': heron_sun_3, 'coopers_hawk_2': coopers_hawk_2, 'raven_3': raven_3, 'heron_sun_4': heron_sun_4, 'heron_sun_5': heron_sun_5, 'whale_breach': whale_breach}

# The shortlist (2026-09-24). The other drawings above stay available.
SHORTLIST = ['coopers_hawk_3', 'coopers_hawk_2', 'lighthouse_v', 'whale_tail_v', 'whale_breach_v',
             'heron_sun_vignette', 'heron_sun_2_v', 'heron_sun_3_v', 'heron_sun_4_v', 'heron_sun_5_v', 'heron_sun_bare']
# Every drawing function in this file that can be called with no arguments, so new ones never need registering.
ALL_FIGURES = {n: f for n, f in list(globals().items())
               if callable(f) and getattr(f, '__module__', None) == __name__
               and f.__code__.co_argcount == len(f.__defaults__ or ())}   # callable with no arguments
FIGURES = {k: ALL_FIGURES[k] for k in SHORTLIST}

if __name__ == '__main__':
    for name, fn in FIGURES.items():
        print(name); print('\n'.join(fn().ansi())); print()

def sheet(path, theme, scale=8):
    from PIL import Image
    tiles = []
    for name, fn in FIGURES.items():
        c = fn(); tmp = path + '.' + name + '.png'; c.png(tmp, theme, scale); tiles.append(Image.open(tmp))
    W = max(t.width for t in tiles); H = max(t.height for t in tiles)
    bg = next((tuple(int(m.group(1)[i:i + 2], 16) for i in (1, 3, 5)) for m in (re.match(r'background = (#[0-9a-fA-F]{6})', l) for l in open(theme)) if m), (0, 0, 0))
    cols = 6
    rows = (len(tiles) + cols - 1) // cols
    out = Image.new('RGB', (cols * (W + 16), rows * (H + 16)), bg)
    for i, t in enumerate(tiles):
        out.paste(t, ((i % cols) * (W + 16) + 8, (i // cols) * (H + 16) + 8))
    out.save(path)
