
global1 = 1

global2 = 1
print(global2)
global2 = 3

global3 = 3
def inner_global():
    print(global3)

global4 = 'global'
def global_shadow():
    global4 = 'local'

global5 = 5
def shadow_global_and_inner():
    global5 = 'local'
    local = 5
    def inner():
        global5 = 'inner'
        print(local)

global6 = 6
def shadow_shadowed_global_from_inner():
    global6 = 'local'
    def inner():
        print(global6)

global7 = 7
def local_shadow_mixed():
    print(global7) # access before is syntax error, but just for test
    global7 = 0

global8 = 8
def global_keyword():
    global global7, global8
    global8 = 88
print(global8)

g9, g10, g11 = 9, 10, 11
def global_lists():
    global g11
    g10 = g9
    g11 = g9
    g10, g11 = g9, g10

class C1:
    this = 'class_contents'
c1 = C1()
def global_class():
    c1 = C1()

def local_class():
    class C2:
        this = 'class_contents'
    c2 = C2()
c2 = C2()

def func1():
    func1()
    def func2():
        func1()
        func2()
    func2()
func1()
func2()

def func3():
    def func3():
        func3()
        def func3():
            func3()
    func3()
func3()

#%%
%%time
%alias bracket echo "Input in brackets: <%l>"
%autocall 1
def func(a):
    %time print 'foo'
%time func 1

#%%
def func_with_args(a, b, c = None, d = None):
    print(a, b, c, d)
func_with_args(1, c = 3, b = 2)
