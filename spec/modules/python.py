
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
def func1_with_args(a, b = 'b', c = None, d = 'd'):
    print(a, b, c, d)

def func2_with_args(a, b, c = None, d = None):
    print(a, b, c, d)

def func3_with_args(a, b, c):
    a = b = c
    print(a)

c = 'x'
func1_with_args(1, c = 3, b = 2)
func3_with_args(a = 1, c, b = c)

def func4_with_args(a, b, c):
    func1_with_args(a = a, b = c, c = b)
    def inner_func(b, c):
        func1_with_args(a = a, b, c = b)
    inner_func(c, b = c, a)
    x = a

#%%
c5 = 'c5'
def func5_with_args(c5, x = c5):
    print(c5, x)
func5_with_args(1)

#%% classes

class Foo:
    def method(self, a, b, c = 1):
        x = a + b
        print(c + x)
        # inner class
        class Foo:
            def method(self, a, b, c = b):
                print(c)
        # ref to inner class & local vars
        foo = Foo(a, x, c)
        # shadowing method name
        def method(a, b = x, x = b):
            print(a, b = a, x)
        # calling local function
        method(a = b, b, x = c)
    # class attribute & ref to self
    foo = Foo(a, b)
# ref to global class
foo = Foo()
foo.method(1, 2, c = 3)
