-- ============================================================
-- SmartEval Seed Data
-- Demo Credentials:
--   Teacher: teacher@example.com  / password123
--   Student: student@example.com  / password123
-- ============================================================

-- Password hashes generated with bcryptjs (rounds=10) for "password123".
-- Hash below is a valid bcrypt hash; verify with:
--   cd backend && node -e "console.log(require('bcryptjs').compareSync('password123','$2a\$10\$lb6P9IJcjna8D.zuA8mhieuG1j9RRaNy7NRJKL3Q9FDLNT/22Z1I2'))"
-- To regenerate for a different password:
--   node -e "console.log(require('bcryptjs').hashSync('NEW_PASSWORD',10))"

INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES
(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'teacher@example.com',
    '$2a$10$lb6P9IJcjna8D.zuA8mhieuG1j9RRaNy7NRJKL3Q9FDLNT/22Z1I2',
    'Sarah',
    'Johnson',
    'teacher'
),
(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'student@example.com',
    '$2a$10$lb6P9IJcjna8D.zuA8mhieuG1j9RRaNy7NRJKL3Q9FDLNT/22Z1I2',
    'Alex',
    'Chen',
    'student'
),
(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'student2@example.com',
    '$2a$10$lb6P9IJcjna8D.zuA8mhieuG1j9RRaNy7NRJKL3Q9FDLNT/22Z1I2',
    'Priya',
    'Patel',
    'student'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Sample Assessment: "CS101 Midterm Exam"
-- ============================================================
INSERT INTO assessments (id, teacher_id, title, description, status, total_marks, duration_minutes, starts_at, ends_at) VALUES
(
    'assess-0001-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'CS101 Midterm Exam - Data Structures',
    'Midterm assessment covering fundamental data structures: arrays, linked lists, stacks, queues, and trees. Includes subjective and programming questions.',
    'published',
    30,
    90,
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '7 days'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Subjective Question
-- ============================================================
INSERT INTO questions (id, assessment_id, question_number, question_type, title, description, max_marks, reference_answer, answer_mode) VALUES
(
    'quest-0001-0000-0000-000000000001',
    'assess-0001-0000-0000-000000000001',
    1,
    'subjective',
    'Explain Stack Data Structure',
    'Define what a Stack data structure is. Explain the LIFO principle with a real-world analogy. Describe the core operations (push, pop, peek) and their time complexity. Provide a concrete use case where stacks are essential in software engineering.',
    10,
    'A Stack is a linear data structure that follows the Last-In-First-Out (LIFO) principle, meaning the last element added is the first one to be removed. A real-world analogy is a stack of plates in a cafeteria: you can only add or remove plates from the top of the stack. Core operations include: 1) push: adds an element to the top (O(1)), 2) pop: removes the top element (O(1)), 3) peek/top: returns the top element without removal (O(1)). Stacks are essential in function call management (call stack), expression evaluation (infix to postfix conversion), undo/redo functionality in editors, and depth-first search (DFS) traversal of graphs and trees.',
    'text'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Programming Question
-- ============================================================
INSERT INTO questions (id, assessment_id, question_number, question_type, title, description, max_marks, reference_answer, answer_mode, programming_language) VALUES
(
    'quest-0002-0000-0000-000000000002',
    'assess-0001-0000-0000-000000000001',
    2,
    'programming',
    'Reverse an Array',
    'Write a function that takes an array of integers and its size as input, and reverses the array in-place. The function should modify the original array without using additional data structures. Return the reversed array.

Example:
Input:  [1, 2, 3, 4, 5]
Output: [5, 4, 3, 2, 1]',
    20,
    'To reverse an array in-place, use the two-pointer technique. Initialize left pointer at index 0 and right pointer at index n-1. While left < right, swap elements at these pointers and increment left, decrement right. This approach runs in O(n) time complexity with O(1) space complexity since we do not use any extra space beyond temporary variables.',
    'text',
    'python'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Rubric for Subjective Question 1
-- ============================================================
INSERT INTO rubrics (id, question_id) VALUES
(
    'rubrc-0001-0000-0000-000000000001',
    'quest-0001-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rubric_criteria (id, rubric_id, criterion_name, description, maximum_marks, sort_order, keywords) VALUES
(
    'critr-0001-0000-0000-000000000001',
    'rubrc-0001-0000-0000-000000000001',
    'Definition',
    'Clear and accurate definition of a Stack data structure',
    2,
    1,
    'stack linear data structure collection elements'
),
(
    'critr-0002-0000-0000-000000000002',
    'rubrc-0001-0000-0000-000000000001',
    'LIFO Explanation',
    'Explanation of the LIFO (Last-In-First-Out) principle with real-world analogy',
    3,
    2,
    'LIFO last first in out order plates cafeteria top analogy'
),
(
    'critr-0003-0000-0000-000000000003',
    'rubrc-0001-0000-0000-000000000001',
    'Core Operations',
    'Description of push, pop, and peek operations with time complexity analysis',
    3,
    3,
    'push pop peek top add remove element time complexity O(1) constant'
),
(
    'critr-0004-0000-0000-000000000004',
    'rubrc-0001-0000-0000-000000000001',
    'Use Cases / Applications',
    'Practical applications and use cases of stacks in software engineering',
    2,
    4,
    'use case application call stack function DFS depth first search undo redo expression evaluation postfix'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Test Cases for Programming Question 2 (Reverse Array)
-- ============================================================
INSERT INTO test_cases (id, question_id, test_case_number, input_data, expected_output, marks, is_hidden, timeout_ms) VALUES
(
    'tcase-0001-0000-0000-000000000001',
    'quest-0002-0000-0000-000000000002',
    1,
    '5
1 2 3 4 5',
    '5 4 3 2 1',
    4,
    false,
    5000
),
(
    'tcase-0002-0000-0000-000000000002',
    'quest-0002-0000-0000-000000000002',
    2,
    '3
10 20 30',
    '30 20 10',
    4,
    false,
    5000
),
(
    'tcase-0003-0000-0000-000000000003',
    'quest-0002-0000-0000-000000000002',
    3,
    '1
42',
    '42',
    4,
    false,
    5000
),
(
    'tcase-0004-0000-0000-000000000004',
    'quest-0002-0000-0000-000000000002',
    4,
    '0',
    '',
    4,
    false,
    5000
),
(
    'tcase-0005-0000-0000-000000000005',
    'quest-0002-0000-0000-000000000002',
    5,
    '10
1 2 3 4 5 6 7 8 9 10',
    '10 9 8 7 6 5 4 3 2 1',
    4,
    true,
    5000
)
ON CONFLICT (id) DO NOTHING;
