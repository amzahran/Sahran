<?php
// SQL Server connection
$serverName = "ahmedzahran\SQL";
$connectionOptions = [
    "Database" => "platform",
    "Uid" => "sa",
    "PWD" => "123123"
];
$conn = sqlsrv_connect($serverName, $connectionOptions);
if (!$conn) {
    die(print_r(sqlsrv_errors(), true));
}

// Debug image uploads
file_put_contents("debug_files.txt", print_r($_FILES, true));

// Handle upload path
$uploadDir = "uploads/";
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

$testTitle = $_POST['TestTitle'] ?? '';
$testType = $_POST['TestType'] ?? '';
$price = $_POST['Price'] ?? 0;
$category = $_POST['Category'] ?? '';
$sections = json_decode($_POST['Sections'], true);

$createdAt = date('Y-m-d H:i:s');

// حذف أي اختبار بنفس العنوان مسبقاً
$sql = "SELECT TestID FROM Tests WHERE TestTitle = ?";
$stmt = sqlsrv_query($conn, $sql, [$testTitle]);
$existingTest = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC);
if ($existingTest) {
    $oldTestID = $existingTest['TestID'];

    sqlsrv_query($conn, "DELETE ao FROM AnswerOptions ao
        INNER JOIN Questions q ON ao.QuestionID = q.QuestionID
        INNER JOIN Sections s ON q.SectionID = s.SectionID
        WHERE s.TestID = ?", [$oldTestID]);

    sqlsrv_query($conn, "DELETE FROM Questions WHERE SectionID IN (SELECT SectionID FROM Sections WHERE TestID = ?)", [$oldTestID]);
    sqlsrv_query($conn, "DELETE FROM Sections WHERE TestID = ?", [$oldTestID]);
    sqlsrv_query($conn, "DELETE FROM Tests WHERE TestID = ?", [$oldTestID]);
}

// إدراج الاختبار الجديد
$sql = "INSERT INTO Tests (TestTitle, TestType, CreatedAt, BreakDuration, CategoryTest, Price, IsActive)
        OUTPUT INSERTED.TestID VALUES (?, ?, ?, ?, ?, ?, ?)";
$stmt = sqlsrv_query($conn, $sql, [$testTitle, $testType, $createdAt, 0, $category, $price, 1]);
$row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC);
$testID = $row['TestID'] ?? 0;

if (!$testID) {
    die("❌ Failed to get inserted TestID");
}

foreach ($sections as $i => $section) {
    $secTitle = $section['SectionTitle'] ?? 'Module ' . ($i + 1);
    $secDur = $section['Duration'] ?? 35;
    $break = $section['BreakDuration'] ?? 10;
    $expectedCount = $section['NumberOfQuestions'] ?? 1;
    $actualQuestions = $section['Questions'] ?? [];

    // enforce expected question count
    if (count($actualQuestions) != $expectedCount) {
        die("❌ Number of questions in section '" . $secTitle . "' must be exactly $expectedCount");
    }

    $sql = "INSERT INTO Sections (TestID, SectionNumber, NumberOfQuestions, Duration, SectionTitle)
            OUTPUT INSERTED.SectionID VALUES (?, ?, ?, ?, ?)";
    $insertSec = sqlsrv_query($conn, $sql, [$testID, $i + 1, $expectedCount, $secDur, $secTitle]);
    $row = sqlsrv_fetch_array($insertSec, SQLSRV_FETCH_ASSOC);
    $sectionID = $row['SectionID'] ?? 0;
    if (!$sectionID) continue;

    foreach ($actualQuestions as $j => $q) {
        $qText = $q['QuestionText'] ?? '';
        $qType = $q['QuestionType'] ?? 'MCQ';

        $qImgField = "questionImage_{$i}_{$j}";
        $qImagePath = null;
        if (!empty($_FILES[$qImgField]['tmp_name']) && is_uploaded_file($_FILES[$qImgField]['tmp_name'])) {
            $filename = basename($_FILES[$qImgField]['name']);
            $qImagePath = $uploadDir . $filename;
            if (!move_uploaded_file($_FILES[$qImgField]['tmp_name'], $qImagePath)) {
                error_log("❌ Failed to move question image: " . $_FILES[$qImgField]['name']);
            }
        }

        $sql = "INSERT INTO Questions (SectionID, QuestionText, QuestionImage, QuestionType)
                OUTPUT INSERTED.QuestionID VALUES (?, ?, ?, ?)";
        $insertQ = sqlsrv_query($conn, $sql, [$sectionID, $qText, $qImagePath, $qType]);
        $row = sqlsrv_fetch_array($insertQ, SQLSRV_FETCH_ASSOC);
        $questionID = $row['QuestionID'] ?? 0;
        if (!$questionID) continue;

        if ($qType === "MCQ") {
            if (!empty($q['Options']) && is_array($q['Options'])) {
                foreach ($q['Options'] as $k => $opt) {
                    $optText = $opt['text'] ?? '';
                    $isCorrect = !empty($opt['isCorrect']) ? 1 : 0;
                    $optImgField = "optionImage_{$i}_{$j}_{$k}";
                    $optImagePath = null;
                    if (!empty($_FILES[$optImgField]['tmp_name']) && is_uploaded_file($_FILES[$optImgField]['tmp_name'])) {
                        $filename = basename($_FILES[$optImgField]['name']);
                        $optImagePath = $uploadDir . $filename;
                        if (!move_uploaded_file($_FILES[$optImgField]['tmp_name'], $optImagePath)) {
                            error_log("❌ Failed to move option image: " . $_FILES[$optImgField]['name']);
                        }
                    }
                    if (trim($optText) !== '') {
                        $sql = "INSERT INTO AnswerOptions (QuestionID, OptionText, OptionImage, IsCorrect) VALUES (?, ?, ?, ?)";
                        sqlsrv_query($conn, $sql, [$questionID, $optText, $optImagePath, $isCorrect]);
                    }
                }
            }
        } elseif ($qType === "GridIn") {
            $gridAns = trim($q['GridAnswer'] ?? '');
            if ($gridAns !== '') {
                $sql = "INSERT INTO AnswerOptions (QuestionID, OptionText, OptionImage, IsCorrect) VALUES (?, ?, NULL, 1)";
                sqlsrv_query($conn, $sql, [$questionID, $gridAns]);
            }
        }
    }
}

echo "✅ Test saved successfully.";
