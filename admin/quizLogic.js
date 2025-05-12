var gk_isXlsx = false;
var gk_xlsxFileLookup = {};
var gk_fileData = {};
function filledCell(cell) {
    return cell !== '' && cell != null;
}
function loadFileData(filename) {
    if (gk_isXlsx && gk_xlsxFileLookup[filename]) {
        try {
            var workbook = XLSX.read(gk_fileData[filename], { type: 'base64' });
            var firstSheetName = workbook.SheetNames[0];
            var worksheet = workbook.Sheets[firstSheetName];
            var jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false, defval: '' });
            var filteredData = jsonData.filter(row => row.some(filledCell));
            var headerRowIndex = filteredData.findIndex((row, index) =>
                row.filter(filledCell).length >= filteredData[index + 1]?.filter(filledCell).length
            );
            if (headerRowIndex === -1 || headerRowIndex > 25) headerRowIndex = 0;
            var csv = XLSX.utils.aoa_to_sheet(filteredData.slice(headerRowIndex));
            csv = XLSX.utils.sheet_to_csv(csv, { header: 1 });
            return csv;
        } catch (e) {
            console.error('Error loading XLSX file:', e);
            return "";
        }
    }
    return gk_fileData[filename] || "";
}

function saveTest(type, testData, testId = null) {
    try {
        const tests = JSON.parse(localStorage.getItem('savedTests')) || {};
        const newTestId = testId || `${type}-${Date.now()}`;
        tests[newTestId] = {
            type: type,
            data: testData,
            createdAt: testId ? tests[newTestId]?.createdAt || new Date().toISOString() : new Date().toISOString(),
            title: testData.title || `Test ${Object.keys(tests).filter(t => tests[t].type === type).length + 1}`,
            isPaid: testId ? tests[newTestId]?.isPaid : Math.random() > 0.5
        };
        localStorage.setItem('savedTests', JSON.stringify(tests));
        return newTestId;
    } catch (e) {
        console.error('Error saving test to localStorage:', e);
        alert('Failed to save test due to storage error. Please check browser settings or storage limits.');
        return null;
    }
}

let currentTestType = '';
let currentSection = 1;
let currentQuestionIndex = 0;
let questionsData = {
    section1: [],
    section2: [],
    section1Questions: 5,
    section2Questions: 5,
    section1Duration: 30,
    section2Duration: 30,
    breakDuration: 10
};

function showQuiz(type) {
    if (!type) {
        console.error('No test type provided');
        alert('Please select a test type.');
        return;
    }
    currentTestType = type;
    const quizSection = document.getElementById('quizSection');
    quizSection.style.display = 'block';
    quizSection.classList.add('active');
    const quizBuilder = document.getElementById('quizBuilder');
    quizBuilder.style.display = 'block';
    const quizDisplaySection = document.getElementById('quizDisplaySection');
    quizDisplaySection.style.display = 'none';
    quizDisplaySection.classList.remove('active');
    updateQuizTitle();
    initQuiz(type);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function hideQuiz() {
    const quizSection = document.getElementById('quizSection');
    quizSection.style.display = 'none';
    quizSection.classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateQuizTitle() {
    const titles = {
        'act-i': 'Create ACT I Quiz',
        'act-ii': 'Create ACT II Quiz',
        'est-i': 'Create EST I Quiz',
        'est-ii': 'Create EST II Quiz',
        'digital-sat': 'Create Digital SAT Quiz',
        'univ-course': 'Create University Courses Quiz'
    };
    document.getElementById('quizTitle').textContent = titles[currentTestType] || 'Create Test';
}

let timeRemainingSection, breakTimeRemaining;
let timerInterval, breakInterval;
let totalTimeSection;
let isBreakTime = false;
let quizQuestionElements = [];

function startTimer(duration, display, progressBar) {
    duration = parseInt(duration) * 60 || 0;
    if (duration <= 0) {
        duration = 1;
    }
    timeRemainingSection = duration;
    totalTimeSection = duration;
    clearInterval(timerInterval);
    timerInterval = setInterval(function() {
        timeRemainingSection--;
        updateTimerDisplay(display, progressBar, timeRemainingSection);
        if (timeRemainingSection <= 0) {
            clearInterval(timerInterval);
            if (currentSection === 1) {
                submitSection1();
            } else {
                submitSection2();
            }
        }
    }, 1000);
}

function startBreak() {
    if (questionsData.section2.length === 0) {
        alert('No questions in Section 2. Ending quiz.');
        document.getElementById('editQuestionsBtn').classList.remove('hidden');
        return;
    }
    isBreakTime = true;
    clearInterval(timerInterval);
    document.getElementById('breakScreen').classList.add('active');
    document.getElementById('quizDisplaySection').style.display = 'none';
    const breakDisplay = document.getElementById('breakTimer');
    breakTimeRemaining = parseInt(questionsData.breakDuration) * 60 || 600;
    clearInterval(breakInterval);
    breakInterval = setInterval(function() {
        breakTimeRemaining--;
        updateTimerDisplay(breakDisplay, null, breakTimeRemaining);
        if (breakTimeRemaining <= 0) {
            clearInterval(breakInterval);
            continueToSection2();
        }
    }, 1000);
}

function continueToSection2() {
    isBreakTime = false;
    document.getElementById('breakScreen').classList.remove('active');
    document.getElementById('quizDisplaySection').style.display = 'block';
    currentSection = 2;
    document.getElementById('currentSectionTitle').textContent = 'Preview Quiz - Section 2';
    document.getElementById('currentSectionTimerLabel').textContent = '2';
    currentQuestionIndex = 0;
    displaySection2();
    startTimer(questionsData.section2Duration, document.getElementById('timerSection1'), document.getElementById('timerProgressBarSection1'));
    MathJax.typesetPromise().catch(err => console.error('MathJax error after break:', err));
}

function updateTimerDisplay(display, progressBar, time) {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    if (progressBar && !isBreakTime) {
        const progressPercent = totalTimeSection > 0 ? (time / totalTimeSection) * 100 : 0;
        progressBar.style.width = `${progressPercent}%`;
        if (progressPercent < 20) progressBar.style.backgroundColor = '#e74c3c';
        else if (progressPercent < 50) progressBar.style.backgroundColor = '#f39c12';
        else progressBar.style.backgroundColor = '#2ecc71';
    }
}

function getPerformanceText(percentage) {
    if (percentage >= 0.9) return "Excellent!";
    if (percentage >= 0.7) return "Good job!";
    if (percentage >= 0.5) return "Average";
    return "Needs improvement";
}

function initQuiz(type) {
    if (!type) {
        console.error('Invalid test type in initQuiz');
        return;
    }
    let questionCounter = 1;
    let editTestId = null;

    const addQuestionBtn = document.getElementById('addQuestionBtn');
    const saveTestBtn = document.getElementById('saveTestBtn');
    const displayQuizBtn = document.getElementById('displayQuizBtn');
    const prevQuestionBtn = document.getElementById('prevQuestion');
    const nextQuestionBtn = document.getElementById('nextQuestion');
    const submitSection1Btn = document.getElementById('submitSection1Btn');
    const submitSection2Btn = document.getElementById('submitSection2Btn');
    const questionsContainer = document.getElementById('questionsContainer');
    const quizQuestionsDiv = document.getElementById('quizQuestions');
    const testTitleInput = document.getElementById('testTitle');
    const editQuestionsBtn = document.getElementById('editQuestionsBtn');
    const section1QuestionsInput = document.getElementById('section1Questions');
    const section2QuestionsInput = document.getElementById('section2Questions');
    const section1DurationInput = document.getElementById('section1Duration');
    const section2DurationInput = document.getElementById('section2Duration');
    const breakDurationInput = document.getElementById('breakDuration');

    editTestId = localStorage.getItem('editTestId');
    if (editTestId) {
        const tests = JSON.parse(localStorage.getItem('savedTests')) || {};
        const test = tests[editTestId];
        if (test) {
            questionsData.section1 = test.data.section1 || [];
            questionsData.section2 = test.data.section2 || [];
            questionsData.section1Questions = test.data.section1Questions || 5;
            questionsData.section2Questions = test.data.section2Questions || 5;
            questionsData.section1Duration = test.data.section1Duration || 30;
            questionsData.section2Duration = test.data.section2Duration || 30;
            questionsData.breakDuration = test.data.breakDuration || 10;
            testTitleInput.value = test.data.title || '';
            section1QuestionsInput.value = test.data.section1Questions || 5;
            section2QuestionsInput.value = test.data.section2Questions || 5;
            section1DurationInput.value = test.data.section1Duration || 30;
            section2DurationInput.value = test.data.section2Duration || 30;
            breakDurationInput.value = test.data.breakDuration || 10;
            while (questionsContainer.children.length > 0) {
                questionsContainer.removeChild(questionsContainer.lastChild);
            }
            questionCounter = 0;
            const allQuestions = [...questionsData.section1, ...questionsData.section2];
            allQuestions.forEach((question, index) => {
                addQuestion();
                const questionDiv = document.getElementById(`question-${index + 1}`);
                const questionTypeSelect = questionDiv.querySelector(`#questionType${index + 1}`);
                questionTypeSelect.value = question.type;
                questionTypeSelect.dispatchEvent(new Event('change'));
                questionDiv.querySelector(`#questionText${index + 1}`).value = question.text;
                if (question.type === 'multiple-choice') {
                    question.options.forEach((option, optIndex) => {
                        questionDiv.querySelector(`#answer${index + 1}_${optIndex + 1}`).value = option;
                    });
                    questionDiv.querySelector(`input[name="correctAnswer${index + 1}"][value="${question.correctAnswer + 1}"]`).checked = true;
                } else {
                    questionDiv.querySelector(`#correct${question.type === 'short-answer' ? 'Short' : 'GridIn'}Answer${index + 1}`).value = question.correctAnswer;
                }
            });
            updateAddQuestionButtonState();

// ✅ إعادة إطلاق change لكل أنواع الأسئلة بعد تحميلها لضمان Grid-In
document.querySelectorAll('#questionsContainer .question-type-select').forEach(select => {
    select.dispatchEvent(new Event('change'));
});

        }
        localStorage.removeItem('editTestId');
    }

    document.querySelectorAll('#questionsContainer .question-type-select').forEach(select => {
        select.addEventListener('change', function() {
            const questionDiv = this.closest('.question-input');
            const questionNum = questionDiv.id.split('-').pop();
            const isMultipleChoice = this.value === 'multiple-choice';
            const isShortAnswer = this.value === 'short-answer';
            const isGridIn = this.value === 'grid-in';
            questionDiv.querySelector(`#answerOptions${questionNum}`).classList.toggle('hidden', !isMultipleChoice);
            questionDiv.querySelector(`#shortAnswerOptions${questionNum}`).classList.toggle('hidden', !isShortAnswer);
            questionDiv.querySelector(`#gridInOptions${questionNum}`).classList.toggle('hidden', !isGridIn);
        });
    });

    function updateAddQuestionButtonState() {
        const section1Count = parseInt(section1QuestionsInput.value) || 5;
        const section2Count = parseInt(section2QuestionsInput.value) || 5;
        const totalAllowed = section1Count + section2Count;
        const currentCount = questionsContainer.querySelectorAll('.question-input').length;
        addQuestionBtn.disabled = currentCount >= totalAllowed;
    }

    function addQuestion() {
        const section1Count = parseInt(section1QuestionsInput.value) || 5;
        const section2Count = parseInt(section2QuestionsInput.value) || 5;
        const totalAllowed = section1Count + section2Count;
        if (questionCounter >= totalAllowed) {
            alert(`You cannot add more questions. The limit is ${section1Count} for Section 1 and ${section2Count} for Section 2.`);
            return;
        }
        questionCounter++;
        const section = questionCounter <= section1Count ? 1 : 2;
        const questionId = `question-${questionCounter}`;
        const newQuestionDiv = document.createElement('div');
        newQuestionDiv.classList.add('question-input');
        newQuestionDiv.id = questionId;
        newQuestionDiv.innerHTML = `
            <h3>Question ${questionCounter} (Section ${section})</h3>
            <div class="question-type-selector">
                <label>Question Type:</label>
                <select id="questionType${questionCounter}" class="question-type-select">
                    <option value="multiple-choice">Multiple Choice</option>
                    <option value="short-answer">Short Answer (Fill in the blank)</option>
                    <option value="grid-in">Grid-In</option>
                </select>
            </div>
            <label for="questionText${questionCounter}">Question Text:</label><br>
            <textarea id="questionText${questionCounter}" rows="3" required></textarea><br><br>
            <label for="questionImage${questionCounter}">Question Image (optional):</label><br>
            <input type="file" id="questionImage${questionCounter}" accept="image/*"><br><br>
            <div id="answerOptions${questionCounter}" class="multiple-choice-options">
                <h4>Answer Options:</h4>
                <div class="answer-options-input">
                    ${[1, 2, 3, 4].map(optionNum => `
                        <div>
                            <label>
                                <input type="radio" name="correctAnswer${questionCounter}" value="${optionNum}" 
                                    ${optionNum === 2 ? 'checked' : ''}>
                                Option ${optionNum}:
                            </label>
                            <input type="text" id="answer${questionCounter}_${optionNum}" required>
                            <label for="answerImage${questionCounter}_${optionNum}">Option ${optionNum} Image (optional):</label>
                            <input type="file" id="answerImage${questionCounter}_${optNum}" accept="image/*">
                        </div>
                    `).join('')}
                </div>
            </div>
            <div id="shortAnswerOptions${questionCounter}" class="short-answer-options hidden">
                <h4>Correct Answer:</h4>
                <input type="text" id="correctShortAnswer${questionCounter}" placeholder="Enter the correct answer">
                <p>Note: The answer will be case-insensitive and trimmed of whitespace for comparison.</p>
            </div>
            <div id="gridInOptions${questionCounter}" class="grid-in-options hidden">
                <h4>Correct Answer:</h4>
                <input type="text" id="correctGridInAnswer${questionCounter}" placeholder="Enter the correct answer">
                <p>Note: The answer will be case-insensitive and trimmed of whitespace for comparison.</p>
            </div>
            <button type="button" class="remove-question" data-question-id="${questionId}">Remove Question</button>
        `;
        questionsContainer.appendChild(newQuestionDiv);
        const questionTypeSelect = newQuestionDiv.querySelector(`#questionType${questionCounter}`);
        questionTypeSelect.addEventListener('change', function() {
            const questionDiv = this.closest('.question-input');
            const questionNum = questionDiv.id.split('-').pop();
            const isMultipleChoice = this.value === 'multiple-choice';
            const isShortAnswer = this.value === 'short-answer';
            const isGridIn = this.value === 'grid-in';
            questionDiv.querySelector(`#answerOptions${questionNum}`).classList.toggle('hidden', !isMultipleChoice);
            questionDiv.querySelector(`#shortAnswerOptions${questionNum}`).classList.toggle('hidden', !isShortAnswer);
            questionDiv.querySelector(`#gridInOptions${questionNum}`).classList.toggle('hidden', !isGridIn);
        });
        newQuestionDiv.querySelector('.remove-question').addEventListener('click', function() {
            if (confirm('Are you sure you want to remove this question?')) {
                questionsContainer.removeChild(newQuestionDiv);
                questionCounter--;
                updateQuestionHeaders();
                updateAddQuestionButtonState();

// ✅ إعادة إطلاق change لكل أنواع الأسئلة بعد تحميلها لضمان Grid-In
document.querySelectorAll('#questionsContainer .question-type-select').forEach(select => {
    select.dispatchEvent(new Event('change'));
});

            }
        });
        newQuestionDiv.scrollIntoView({ behavior: 'smooth' });
        updateAddQuestionButtonState();

// ✅ إعادة إطلاق change لكل أنواع الأسئلة بعد تحميلها لضمان Grid-In
document.querySelectorAll('#questionsContainer .question-type-select').forEach(select => {
    select.dispatchEvent(new Event('change'));
});

    }

    function updateQuestionHeaders() {
        const section1Count = parseInt(section1QuestionsInput.value) || 5;
        const questions = questionsContainer.querySelectorAll('.question-input');
        questions.forEach((q, index) => {
            const questionNum = index + 1;
            const section = questionNum <= section1Count ? 1 : 2;
            q.querySelector('h3').textContent = `Question ${questionNum - (section === 2 ? section1Count : 0)} (Section ${section})`;
            q.id = `question-${questionNum}`;
        });
        questionCounter = questions.length;
        updateAddQuestionButtonState();

// ✅ إعادة إطلاق change لكل أنواع الأسئلة بعد تحميلها لضمان Grid-In
document.querySelectorAll('#questionsContainer .question-type-select').forEach(select => {
    select.dispatchEvent(new Event('change'));
});

    }

    async function saveTestToStorage() {
        const section1Count = parseInt(section1QuestionsInput.value) || 5;
        const section2Count = parseInt(section2QuestionsInput.value) || 5;
        const totalQuestions = questionsContainer.querySelectorAll('.question-input').length;
        if (totalQuestions !== section1Count + section2Count) {
            alert(`Please add exactly ${section1Count} questions for Section 1 and ${section2Count} questions for Section 2. You currently have ${totalQuestions} questions.`);
            return;
        }
        const testTitle = testTitleInput.value.trim();
        if (!testTitle) {
            alert('Please enter a test title.');
            return;
        }
        const testData = {
            title: testTitle,
            section1: [],
            section2: [],
            section1Questions: section1Count,
            section2Questions: section2Count,
            section1Duration: parseInt(section1DurationInput.value) || 30,
            section2Duration: parseInt(section2DurationInput.value) || 30,
            breakDuration: parseInt(breakDurationInput.value) || 10
        };
        for (let i = 1; i <= totalQuestions; i++) {
            const questionTextEl = document.getElementById(`questionText${i}`);
            if (!questionTextEl) continue;
            const questionText = questionTextEl.value.trim();
            if (!questionText) continue;
            const questionImageFile = document.getElementById(`questionImage${i}`)?.files[0];
            const questionType = document.getElementById(`questionType${i}`).value;
            const questionImage = questionImageFile ? await readFileAsDataURL(questionImageFile) : null;
            const section = i <= section1Count ? 'section1' : 'section2';
            if (questionType === 'multiple-choice') {
                const answers = [1, 2, 3, 4].map(opt => {
                    const answerEl = document.getElementById(`answer${i}_${opt}`);
                    return answerEl ? answerEl.value.trim() : '';
                }).filter(ans => ans);
                if (answers.length < 4) console.warn(`Question ${i} has incomplete options, proceeding with available`);
                const answerImageFiles = [1, 2, 3, 4].map(opt => document.getElementById(`answerImage${i}_${opt}`)?.files[0]);
                const correctAnswerRadio = document.querySelector(`input[name="correctAnswer${i}"]:checked`);
                const correctAnswerIndex = correctAnswerRadio ? parseInt(correctAnswerRadio.value) - 1 : 0;
                const answerImages = await Promise.all(answerImageFiles.map(file => file ? readFileAsDataURL(file) : null));
                testData[section].push({
                    id: `q${i}`,
                    text: questionText,
                    type: 'multiple-choice',
                    options: answers,
                    correctAnswer: correctAnswerIndex,
                    questionImage: questionImage,
                    answerImages: answerImages
                });
            } else if (questionType === 'short-answer') {
                const correctAnswer = document.getElementById(`correctShortAnswer${i}`)?.value.trim() || '';
                testData[section].push({
                    id: `q${i}`,
                    text: questionText,
                    type: 'short-answer',
                    correctAnswer: correctAnswer,
                    questionImage: questionImage
                });
            } else if (questionType === 'grid-in') {
                const correctAnswer = document.getElementById(`correctGridInAnswer${i}`)?.value.trim() || '';
                testData[section].push({
                    id: `q${i}`,
                    text: questionText,
                    type: 'grid-in',
                    correctAnswer: correctAnswer,
                    questionImage: questionImage
                });
            }
        }
        if (testData.section1.length + testData.section2.length === 0) {
            alert('No valid questions to save. Please add at least one complete question.');
            return;
        }
        questionsData.section1 = testData.section1;
        questionsData.section2 = testData.section2;
        questionsData.section1Questions = testData.section1Questions;
        questionsData.section2Questions = testData.section2Questions;
        questionsData.section1Duration = testData.section1Duration;
        questionsData.section2Duration = testData.section2Duration;
        questionsData.breakDuration = testData.breakDuration;
        const testId = saveTest(type, testData, editTestId);
        if (testId) {
            alert('Test saved successfully!');
            editTestId = null;
        }
    }

    async function displayQuiz() {
        const section1Count = questionsData.section1.length;
        const section2Count = questionsData.section2.length;
        if (section1Count + section2Count === 0) {
            alert('No questions available to display. Please create and save a test first.');
            return;
        }
        quizQuestionElements = [];
        currentQuestionIndex = 0;
        currentSection = 1;
        displaySection1();
        document.getElementById('quizBuilder').style.display = 'none';
        document.getElementById('quizDisplaySection').classList.add('active');
        startTimer(questionsData.section1Duration, document.getElementById('timerSection1'), document.getElementById('timerProgressBarSection1'));
        MathJax.typesetPromise().catch(err => console.error('MathJax error:', err));
    }

    function displaySection1() {
        quizQuestionElements = [];
        const quizQuestionsDiv = document.getElementById('quizQuestions');
        quizQuestionsDiv.innerHTML = '';
        let section1QuestionNum = 1;
        questionsData.section1.forEach((question, i) => {
            if (question.type === 'multiple-choice') {
                const questionElement = document.createElement('div');
                questionElement.className = 'quiz-question';
                questionElement.id = `quiz-question-${section1QuestionNum}-s1`;
                questionElement.innerHTML = `
                    <h3>Question ${section1QuestionNum} (Section 1):</h3>
                    <p>${question.text}</p>
                    ${question.questionImage ? `<div class="image-container"><img src="${question.questionImage}" alt="Question Image" class="question-image"></div>` : ''}
                    <div class="answer-options-styled">
                        ${question.options.map((answer, index) => `
                            <label class="answer-option-container">
                                <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                                <input type="radio" name="userAnswer${section1QuestionNum}-s1" value="${index}">
                                <span class="answer-text">${answer}</span>
                                ${question.answerImages && question.answerImages[index] ? `<div class="image-container"><img src="${question.answerImages[index]}" alt="Option ${index + 1} Image" class="answer-image"></div>` : ''}
                            </label>
                        `).join('')}
                    </div>
                `;
                quizQuestionsDiv.appendChild(questionElement);
                quizQuestionElements.push(questionElement);
            } else if (question.type === 'short-answer') {
                const questionElement = document.createElement('div');
                questionElement.className = 'quiz-question';
                questionElement.id = `quiz-question-${section1QuestionNum}-s1`;
                questionElement.innerHTML = `
                    <h3>Question ${section1QuestionNum} (Section 1):</h3>
                    <p>${question.text}</p>
                    ${question.questionImage ? `<div class="image-container"><img src="${question.questionImage}" alt="Question Image" class="question-image"></div>` : ''}
                    <input type="text" id="shortAnswer${section1QuestionNum}-s1" class="short-answer-input" placeholder="Enter your answer">
                `;
                quizQuestionsDiv.appendChild(questionElement);
                quizQuestionElements.push(questionElement);
            } else if (question.type === 'grid-in') {
                const questionElement = document.createElement('div');
                questionElement.className = 'quiz-question';
                questionElement.id = `quiz-question-${section1QuestionNum}-s1`;
                questionElement.innerHTML = `
                    <h3>Question ${section1QuestionNum} (Section 1):</h3>
                    <p>${question.text}</p>
                    ${question.questionImage ? `<div class="image-container"><img src="${question.questionImage}" alt="Question Image" class="question-image"></div>` : ''}
                    <div class="grid-in-section">
                        <div class="grid-in-answer-box">
                            <input type="text" id="gridInAnswer${section1QuestionNum}-s1" class="grid-in-input" placeholder="Enter your answer">
                            <div class="grid-in-line"></div>
                        </div>
                    </div>
                `;
                quizQuestionsDiv.appendChild(questionElement);
                quizQuestionElements.push(questionElement);
            }
            section1QuestionNum++;
        });
        showQuestion(0);
    }

    function displaySection2() {
        quizQuestionElements = [];
        const quizQuestionsDiv = document.getElementById('quizQuestions');
        quizQuestionsDiv.innerHTML = '';
        let section2QuestionNum = 1;
        questionsData.section2.forEach((question, i) => {
            if (question.type === 'multiple-choice') {
                const questionElement = document.createElement('div');
                questionElement.className = 'quiz-question';
                questionElement.id = `quiz-question-${section2QuestionNum}-s2`;
                questionElement.innerHTML = `
                    <h3>Question ${section2QuestionNum} (Section 2):</h3>
                    <p>${question.text}</p>
                    ${question.questionImage ? `<div class="image-container"><img src="${question.questionImage}" alt="Question Image" class="question-image"></div>` : ''}
                    <div class="answer-options-styled">
                        ${question.options.map((answer, index) => `
                            <label class="answer-option-container">
                                <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                                <input type="radio" name="userAnswer${section2QuestionNum}-s2" value="${index}">
                                <span class="answer-text">${answer}</span>
                                ${question.answerImages && question.answerImages[index] ? `<div class="image-container"><img src="${question.answerImages[index]}" alt="Option ${index + 1} Image" class="answer-image"></div>` : ''}
                            </label>
                        `).join('')}
                    </div>
                `;
                quizQuestionsDiv.appendChild(questionElement);
                quizQuestionElements.push(questionElement);
            } else if (question.type === 'short-answer') {
                const questionElement = document.createElement('div');
                questionElement.className = 'quiz-question';
                questionElement.id = `quiz-question-${section2QuestionNum}-s2`;
                questionElement.innerHTML = `
                    <h3>Question ${section2QuestionNum} (Section 2):</h3>
                    <p>${question.text}</p>
                    ${question.questionImage ? `<div class="image-container"><img src="${question.questionImage}" alt="Question Image" class="question-image"></div>` : ''}
                    <input type="text" id="shortAnswer${section2QuestionNum}-s2" class="short-answer-input" placeholder="Enter your answer">
                `;
                quizQuestionsDiv.appendChild(questionElement);
                quizQuestionElements.push(questionElement);
            } else if (question.type === 'grid-in') {
                const questionElement = document.createElement('div');
                questionElement.className = 'quiz-question';
                questionElement.id = `quiz-question-${section2QuestionNum}-s2`;
                questionElement.innerHTML = `
                    <h3>Question ${section2QuestionNum} (Section 2):</h3>
                    <p>${question.text}</p>
                    ${question.questionImage ? `<div class="image-container"><img src="${question.questionImage}" alt="Question Image" class="question-image"></div>` : ''}
                    <div class="grid-in-section">
                        <div class="grid-in-answer-box">
                            <input type="text" id="gridInAnswer${section2QuestionNum}-s2" class="grid-in-input" placeholder="Enter your answer">
                            <div class="grid-in-line"></div>
                        </div>
                    </div>
                `;
                quizQuestionsDiv.appendChild(questionElement);
                quizQuestionElements.push(questionElement);
            }
            section2QuestionNum++;
        });
        showQuestion(0);
    }

    function showQuestion(index) {
        quizQuestionElements.forEach((el, i) => el.classList.toggle('active', i === index));
        const totalQuestionsInSection = currentSection === 1 ? questionsData.section1.length : questionsData.section2.length;
        document.getElementById('currentQuestionNumber').textContent = `Question ${index + 1} of ${totalQuestionsInSection} (Section ${currentSection})`;
        const prevQuestionBtn = document.getElementById('prevQuestion');
        const nextQuestionBtn = document.getElementById('nextQuestion');
        const submitSection1Btn = document.getElementById('submitSection1Btn');
        const submitSection2Btn = document.getElementById('submitSection2Btn');
        prevQuestionBtn.disabled = index === 0;
        nextQuestionBtn.disabled = index === totalQuestionsInSection - 1;
        submitSection1Btn.classList.toggle('hidden', currentSection !== 1 || index !== totalQuestionsInSection - 1);
        submitSection2Btn.classList.toggle('hidden', currentSection !== 2 || index !== totalQuestionsInSection - 1);
        if (submitSection1Btn.classList.contains('hidden') && submitSection2Btn.classList.contains('hidden')) {
            nextQuestionBtn.classList.remove('hidden');
        } else {
            nextQuestionBtn.classList.add('hidden');
        }
    }

    function submitSection1() {
        clearInterval(timerInterval);
        const resultsDiv = document.getElementById('resultsSection1');
        let correctAnswers = 0;
        const section1Count = questionsData.section1.length;
        resultsDiv.innerHTML = '<h3>Section 1 Results</h3>';
        questionsData.section1.forEach((question, i) => {
            const questionNum = i + 1;
            let userAnswer, isCorrect;
            if (question.type === 'multiple-choice') {
                const selectedOption = document.querySelector(`input[name="userAnswer${questionNum}-s1"]:checked`);
                userAnswer = selectedOption ? parseInt(selectedOption.value) : null;
                isCorrect = userAnswer !== null && userAnswer === question.correctAnswer;
            } else if (question.type === 'short-answer') {
                userAnswer = document.getElementById(`shortAnswer${questionNum}-s1`)?.value.trim().toLowerCase();
                isCorrect = userAnswer === question.correctAnswer.toLowerCase();
            } else if (question.type === 'grid-in') {
                userAnswer = document.getElementById(`gridInAnswer${questionNum}-s1`)?.value.trim().toLowerCase();
                isCorrect = userAnswer === question.correctAnswer.toLowerCase();
            }
            if (isCorrect) correctAnswers++;
            const resultItem = document.createElement('div');
            resultItem.className = `result-item ${isCorrect ? 'correct' : 'incorrect'}`;
            resultItem.innerHTML = `
                <p><strong>Question ${questionNum}:</strong> ${question.text}</p>
                <div class="answer-comparison">
                    <div class="user-answer"><strong>Your Answer:</strong> ${userAnswer !== null ? (question.type === 'multiple-choice' ? question.options[userAnswer] : userAnswer) : 'Not answered'}</div>
                    <div class="correct-answer"><strong>Correct Answer:</strong> ${question.type === 'multiple-choice' ? question.options[question.correctAnswer] : question.correctAnswer}</div>
                </div>
                <span class="result-icon">${isCorrect ? '✔' : '✘'}</span>
            `;
            resultsDiv.appendChild(resultItem);
        });
        const percentage = (correctAnswers / section1Count) * 100;
        resultsDiv.innerHTML += `
            <div class="test-report">
                <div class="report-summary">
                    <div class="score-card">
                        <div class="score-circle"><span>${correctAnswers}/${section1Count}</span><span>Score</span></div>
                        <p>${getPerformanceText(correctAnswers / section1Count)}</p>
                    </div>
                    <div class="score-card">
                        <div class="score-circle"><span>${percentage.toFixed(1)}%</span><span>Percentage</span></div>
                    </div>
                </div>
                <div class="detailed-results"><h3>Section 1 Detailed Results</h3>${resultsDiv.innerHTML}</div>
            </div>
        `;
        resultsDiv.classList.remove('hidden');
        startBreak();
    }

    function submitSection2() {
        clearInterval(timerInterval);
        const resultsDiv = document.getElementById('resultsSection2');
        let correctAnswers = 0;
        const section2Count = questionsData.section2.length;
        resultsDiv.innerHTML = '<h3>Section 2 Results</h3>';
        questionsData.section2.forEach((question, i) => {
            const questionNum = i + 1;
            let userAnswer, isCorrect;
            if (question.type === 'multiple-choice') {
                const selectedOption = document.querySelector(`input[name="userAnswer${questionNum}-s2"]:checked`);
                userAnswer = selectedOption ? parseInt(selectedOption.value) : null;
                isCorrect = userAnswer !== null && userAnswer === question.correctAnswer;
            } else if (question.type === 'short-answer') {
                userAnswer = document.getElementById(`shortAnswer${questionNum}-s2`)?.value.trim().toLowerCase();
                isCorrect = userAnswer === question.correctAnswer.toLowerCase();
            } else if (question.type === 'grid-in') {
                userAnswer = document.getElementById(`gridInAnswer${questionNum}-s2`)?.value.trim().toLowerCase();
                isCorrect = userAnswer === question.correctAnswer.toLowerCase();
            }
            if (isCorrect) correctAnswers++;
            const resultItem = document.createElement('div');
            resultItem.className = `result-item ${isCorrect ? 'correct' : 'incorrect'}`;
            resultItem.innerHTML = `
                <p><strong>Question ${questionNum}:</strong> ${question.text}</p>
                <div class="answer-comparison">
                    <div class="user-answer"><strong>Your Answer:</strong> ${userAnswer !== null ? (question.type === 'multiple-choice' ? question.options[userAnswer] : userAnswer) : 'Not answered'}</div>
                    <div class="correct-answer"><strong>Correct Answer:</strong> ${question.type === 'multiple-choice' ? question.options[question.correctAnswer] : question.correctAnswer}</div>
                </div>
                <span class="result-icon">${isCorrect ? '✔' : '✘'}</span>
            `;
            resultsDiv.appendChild(resultItem);
        });
        const percentage = (correctAnswers / section2Count) * 100;
        resultsDiv.innerHTML += `
            <div class="test-report">
                <div class="report-summary">
                    <div class="score-card">
                        <div class="score-circle"><span>${correctAnswers}/${section2Count}</span><span>Score</span></div>
                        <p>${getPerformanceText(correctAnswers / section2Count)}</p>
                    </div>
                    <div class="score-card">
                        <div class="score-circle"><span>${percentage.toFixed(1)}%</span><span>Percentage</span></div>
                    </div>
                </div>
                <div class="detailed-results"><h3>Section 2 Detailed Results</h3>${resultsDiv.innerHTML}</div>
            </div>
        `;
        resultsDiv.classList.remove('hidden');
        document.getElementById('editQuestionsBtn').classList.remove('hidden');
        document.getElementById('submitSection2Btn').classList.add('hidden');
    }

    addQuestionBtn.addEventListener('click', addQuestion);
    saveTestBtn.addEventListener('click', saveTestToStorage);
    displayQuizBtn.addEventListener('click', displayQuiz);
    prevQuestionBtn.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            showQuestion(currentQuestionIndex);
        }
    });
    nextQuestionBtn.addEventListener('click', () => {
        const totalQuestionsInSection = currentSection === 1 ? questionsData.section1.length : questionsData.section2.length;
        if (currentQuestionIndex < totalQuestionsInSection - 1) {
            currentQuestionIndex++;
            showQuestion(currentQuestionIndex);
        }
    });
    submitSection1Btn.addEventListener('click', submitSection1);
    submitSection2Btn.addEventListener('click', submitSection2);
    editQuestionsBtn.addEventListener('click', () => {
        document.getElementById('quizBuilder').style.display = 'block';
        document.getElementById('quizDisplaySection').classList.remove('active');
        document.getElementById('editQuestionsBtn').classList.add('hidden');
        document.getElementById('resultsSection1').classList.add('hidden');
        document.getElementById('resultsSection2').classList.add('hidden');
    });
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}