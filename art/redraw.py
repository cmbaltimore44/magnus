"""Replace one drawing function in figures.py without touching anything after it."""
import re, sys
def replace_function(name, new_source, path='figures.py'):
    s = open(path).read()
    i = s.index(f'def {name}(')
    m = re.compile(r'^(def |[A-Z_]+ = |if __name__)', re.M).search(s, i + 5)   # next def OR top-level assignment
    s = s[:i] + new_source.strip('\n') + '\n\n' + s[m.start():]
    open(path, 'w').write(s)
