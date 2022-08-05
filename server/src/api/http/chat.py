# MIT License

# Copyright (c) 2022 LawTotem#8511

# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:

# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.

# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

from aiohttp import web
from aiohttp_security import check_authorized

from ...models import User, PlayerRoom, Room
from ..socket.gamelog import log_event,send_log_event,FromGLE

from ...logs import logger

from arpeggio import Optional, OneOrMore, RegExMatch, ParserPython
from random import randint
from math import floor
from operator import mod

# "Chat" messages are parsed to find the parts of them which need to be evaluated.
# There are three general things which we need to parse
# 1. Simple math equations, this includes simple numbers and basic expressions.
#    To keep the evaluation simple I require that the equation be written of the form (a*b)
#    so ((a+b)*c) but not (a+b*c) because I couldn't justify the effort for operation order
#    Note: Division is always rounded down, if you want rounded up (a+(b-1))/b is rounded up
# 2. Dice rolls like 3d6. Math expressions can be used instead of simple numbers so (1+3)d(4/2)
#    Dice modifiers are also supported.
#    The dice are summed and the dice results used in the sum are returned.
#    I couldn't justify the added complexity of keeping the un used dice.
# 3. Complex dice expressions, expressions which combine dice and simple math expressions.
#
# Note that this means we cannot have dice rolls to generate either the number of dice
# or the number of faces of another roll.
#
# For each of these things we define a Parsing Expression Grammar via arpeggio and a function
# which is capable of 'rendering' the parsing, calcM() for simple math expressions, calcD() for
# dice expressions and calcE() for the complex expressions.

# 1. MATH EXPRESSIONS
# Pretty straight forward
# Addition, Subtration, Division, Multiplication, Exponential, Modulo Arithmetic
# Integer only, Division is 'floored', always rounded down 9/10 = 0

def digit(): return list("0123456789")

def number(): return OneOrMore(list("0123456789"))

def binary_operator(): return [
    "+", # Addition
    "-", # Subtraction
    "/", # Division
    "*", # Multiplication
    "^", # Exponential
    "%", # Modulo Arithmetic
]

def math_expression(): return [
    number, # Either a number
    ("(", math_expression, binary_operator, math_expression, ")") # or 
    ]

def calcM(element) :
    if element.rule_name == "math_expression":
        if len(element) == 1:
            return calcM(element[0])
        if len(element) == 5:
            a = calcM(element[1])
            b = calcM(element[3])
            op = str(element[2])
            if op  == "+" :
                return a + b
            if op == "-" :
                return a - b
            if op == "/" :
                if b == 0 : return a
                return floor(a/b)
            if op == "*" :
                return a * b
            if op == "^":
                if a == 0 : return 1
                return a ** b
            if op == "%" :
                if b == 0 : return 0
                return mod(a,b)
    if element.rule_name == "number":
        return int("".join([str(e) for e in element]))

# 2. Dice expressions
# I wrote in support for the following dice modifiers
# ! - explosion, dice that meet the condition are rolled again, both results used
#     defaults to max on the dice but any logical expression can be applied. All
#     additional dice are not exploded.
#     1d20! 1d10!>5
# !! - compounding explode, as with explosion except the new dice can also explode
#      some checks are in place to ensure impossible compounding explosions cannot
#      be attempted 1d1!! for instance.
#      3d6!! 3d8!!<=4
# !p - penetrating explosion, compounding explode except the number of faces on
#      the dice decrease with each explosion 1d20 - 20 explodes into 1d19, 19 
#      explodes into 1d18 et cetera.
#      10d10!p 4d6!p!=6
# d - drop the lowest number of dice
#      2d20d1 4d20d3
# k - keep the highest number dice
#      2d20k1 8d6k3
# ro - Reroll dice that meet the condition, once. Default condition is ==1
#     2d10ro<5
# r - Reroll dice that meet the condition, as many times as necessary.
#     Default condition is ==1.
#     Some checks are applied to ensure the request isn't impossible.
#     3d4r==2
# b - Keep lowest, bottom, number of dice
#     2d20b1 3d10b2 

def logical_comparator(): return [
        "==", # Equals
        "!=", # Not Equal
        ">=", # Greater than or equal
        "<=", # Less than or equal
        ">", # Greater than
        "<", # Less than
        ]

def dice_compound_explode(): return "!!", Optional((logical_comparator, math_expression))
def dice_pen_explode(): return "!p", Optional((logical_comparator, math_expression))
def dice_explode(): return "!", Optional((logical_comparator, math_expression))
def dice_drop(): return "d", math_expression
def dice_keep(): return "k", math_expression
def dice_reroll_once(): return "ro", Optional((logical_comparator, math_expression))
def dice_reroll(): return "r", Optional((logical_comparator, number))
def dice_bottom(): return "b", math_expression
def dice_mod(): return [dice_compound_explode,
                        dice_pen_explode,
                        dice_explode,
                        dice_drop,
                        dice_keep,
                        dice_reroll_once,
                        dice_reroll,
                        dice_bottom
                        ]
def dice_roll(): return math_expression, "d", math_expression, Optional(dice_mod)
def doRoll(num, faces) :
    if num > 300 : num = 300
    if num < 0 : num = 0
    if faces > 300 : faces = 300
    if faces < 0 : return [0 for i in range(num)]
    return [randint(0, faces-1)+1 for i in range(num)]
def modRoll(rolls, faces, mod):
    if mod[0].rule_name == "dice_compound_explode" :
        op = "=="
        val = faces
        if len(mod[0]) == 3:
            op = str(mod[0][1])
            val = calcM(mod[0][2])
        last_rolls = rolls
        num_new = 0
        while len(rolls) < 100:
            if op == "==":
                num_new = sum([l == val for l in last_rolls])
            if op == "!=":
                num_new = sum([l != val for l in last_rolls])
            if op == ">=":
                num_new = sum([l >= val for l in last_rolls])
            if op == "<=":
                num_new = sum([l <= val for l in last_rolls])
            if op == ">":
                num_new = sum([l > val for l in last_rolls])
            if op == "<":
                num_new = sum([l < val for l in last_rolls])
            if num_new == 0 :
                break;
            else :
                last_rolls = doRoll(num_new, faces)
                rolls = rolls + last_rolls
        return rolls
    if mod[0].rule_name == "dice_pen_explode" :
        op = "=="
        val = faces
        if len(mod[0]) == 3:
            op = str(mod[0][1])
            val = calcM(mod[0][2])
        last_rolls = rolls
        num_new = 0
        while len(rolls) < 100:
            if op == "==" and val > 1:
                num_new = sum([l == val for l in last_rolls])
            if op == "!=" :
                num_new = sum([l != val for l in last_rolls])
            if op == ">=" :
                num_new = sum([l >= val for l in last_rolls])
            if op == "<=" :
                num_new = sum([l <= val for l in last_rolls])
            if op == ">" :
                num_new = sum([l > val for l in last_rolls])
            if op == "<" :
                num_new = sum([l < val for l in last_rolls])
            faces = faces - 1
            if num_new == 0 or faces == 0 :
                break;
            else :
                last_rolls = doRoll(num_new, faces)
                rolls = rolls + last_rolls
                if len(mod) == 1 : val = faces
        return rolls
    if mod[0].rule_name == "dice_explode" :
        op = "=="
        val = faces
        if len(mod[0]) == 3:
            op = str(mod[0][1])
            val = calcM(mod[0][2])
        last_rolls = rolls
        new_rolls = rolls
        num_new = 0
        if op == "==" and val > 1:
            num_new = sum([l == val for l in last_rolls])
        if op == "!=" :
            num_new = sum([l != val for l in last_rolls])
        if op == ">=" :
            num_new = sum([l >= val for l in last_rolls])
        if op == "<=" :
            num_new = sum([l <= val for l in last_rolls])
        if op == ">" :
            num_new = sum([l > val for l in last_rolls])
        if op == "<" :
            num_new = sum([l < val for l in last_rolls])
        if num_new != 0 :
            last_rolls = doRoll(num_new, faces)
            new_rolls = new_rolls + last_rolls
        return new_rolls
    if mod[0].rule_name == "dice_drop" :
        val = calcM(mod[0][1])
        sort_roll = rolls
        sort_roll.sort()
        nd = len(rolls)
        nk = nd - val
        if nk > 0 :
            return sort_roll[:nk]
        return []
    if mod[0].rule_name == "dice_keep" :
        nk = calcM(mod[0][1])
        sort_roll = rolls
        sort_roll.sort()
        if nk > 0 :
            return sort_roll[:nk]
        return []
    if mod[0].rule_name == "dice_bottom" :
        nd = calcM(mod[0][1])
        sort_roll = rolls
        sort_roll.sort()
        if nd < len(rolls) :
            return sort_roll[nd:]
        return []
    if mod[0].rule_name == "dice_reroll_once" :
        op = "<="
        val = 1
        if len(mod[0]) == 3:
            op = str(mod[0][1])
            val = calcM(mod[0][2])
        keep = rolls
        num_new = 0
        num_orig = len(keep)
        if op == "==" and faces != 1 :
            keep = [l for l in keep if l != val]
        if op == "!=" and val > 0 and val <= faces :
            keep = [l for l in keep if l == val]
        if op == ">=" and val > 1 :
            keep = [l for l in keep if l < val]
        if op == "<=" and val < faces :
            keep = [l for l in keep if l > val]
        if op == ">"  and val <= faces:
            keep = [l for l in keep if l <= val]
        if op == "<" and val >= 1 :
            keep = [l for l in keep if l >= val]
        num_new = num_orig - len(keep)
        if num_new :
            keep = keep + doRoll(num_new, faces)
        return keep
    if mod[0].rule_name == "dice_reroll" :
        op = "<="
        val = 1
        if len(mod[0]) == 3:
            op = str(mod[0][1])
            val = calcM(mod[0][2])
        keep = rolls
        num_rerolls = 0
        while num_rerolls < 100 :
            num_new = 0
            num_orig = len(keep)
            if op == "==":
                keep = [l for l in keep if l != val]
            if op == "!=":
                keep = [l for l in keep if l == val]
            if op == ">=":
                keep = [l for l in keep if l < val]
            if op == "<=":
                keep = [l for l in keep if l > val]
            if op == ">":
                keep = [l for l in keep if l <= val]
            if op == "<":
                keep = [l for l in keep if l >= val]
            num_new = num_orig - len(keep)
            num_rerolls = num_rerolls + num_new
            if num_new :
                keep = keep + doRoll(num_new, faces)
            else :
                break;
        return keep

def calcD(element) :
    if element.rule_name == "dice_roll" :
        num_dice = calcM(element[0])
        faces = calcM(element[2])
        rolls = doRoll(num_dice, faces)
        if len(element) == 4:
            rolls = modRoll(rolls, faces, element[3])
        return (sum(rolls), rolls)

def dice_expression(): return [ ("(", dice_expression, binary_operator, dice_expression, ")"), dice_roll, math_expression]


def calcE(element) :
    if len(element) == 5 :
        a = calcE(element[1])
        b = calcE(element[3])
        op = str(element[2])
        combo = [a[1], b[1]]
        if len(a[1]) == 0 :
            combo = b[1]
        if len(b[1]) == 0:
            combo = a[1]
        if op == "+" :
            return (a[0] + b[0], combo)
        if op == "-" :
            return (a[0] - b[0], combo)
        if op == "/" :
            return (floor(a[0] / b[0]), combo)
        if op == "*" :
            return (a[0] * b[0], combo)
        if op == "^" :
            return (a[0] ** b[0], combo)
        if op == "%" :
            return (a[0] + b[0], combo)
        if op == "+" :
            return (mod(a[0], b[0]), combo)
    if len(element) == 1 :
        if element[0].rule_name == "dice_roll" : return calcD(element[0])
        if element[0].rule_name == "math_expression" : return (calcM(element[0]), [])
        if element[0].rule_name == "dice_expression" : return calcE(element[0])

def equation_request() : return "[[", dice_expression, "]]"

def render(element) :
    if (element.rule_name == "equation_request") :
        (s, r) = calcE(element[1])
        return str(s) + " {" + element[1].flat_str() + " " + str(r) + "}"
    return "" + element.flat_str()

def chat_request(): return [(equation_request, chat_request), equation_request, (RegExMatch("."), chat_request),  RegExMatch(".")]
def parseChat(tree):
    if len(tree) == 2 :
        return render(tree[0]) + parseChat(tree[1])
    return render(tree[0])

chat_parser = ParserPython(chat_request,skipws=False)

async def chat(request: web.Request) -> web.Response:
    user: User = await check_authorized(request)

    creator = request.match_info["creator"]
    roomname = request.match_info["roomname"]

    rooms = (
        PlayerRoom.select()
        .join(Room)
        .join(User)
        .filter(player=user)
        .where((User.name == creator) & (Room.name == roomname))
    )

    if len(rooms) != 1:
        return web.HTTPNotFound()
    room = rooms[0]
    contents = await request.text()
    if contents :
        if len(contents) > 200 : contents = "Message too long."
        parse_tree = chat_parser.parse(contents)
        game_log_contents = parseChat(parse_tree)
        if len(game_log_contents) > 200 :  game_log_contents = "Message too long."
        entry = log_event(room, user.name, True, game_log_contents)
        await send_log_event(FromGLE(entry))
    return web.HTTPOk()

