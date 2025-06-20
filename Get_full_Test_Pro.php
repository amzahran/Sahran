<?php
header('Content-Type: text/plain');
$input = json_decode(file_get_contents("php://input"), true);

$serverName = "ahmedzahran\SQL";
$connectionInfo = ["Database" => "platform", "UID" => "sa", "PWD" => "123123"];
$conn = sqlsrv_connect($serverName, $connectionInfo);

if (!$conn) {
    die(print_r(sqlsrv_errors(), true));
}

$testID = $input["TestID"];
$testTitle = $input["TestTitle"];
$testType = $input["TestType"];
$category = $input["CategoryTest"];
$price = $input["Price"];
$sections = $input["Sections"];

// تحديث بيانات الاختبار الأساسية
$updateTest = "UPDATE Tests SET TestTitle = ?, TestType = ?, CategoryTest = ?, Price = ? WHERE TestID = ?";
$paramsTest = [$testTitle, $testType, $category, $price, $testID];
$stmt = sqlsrv_query($conn, $updateTest, $paramsTest);
if ($stmt === false) die(print_r(sqlsrv_errors(), true));

// حذف البيانات القديمة
sqlsrv_query($conn, "DELETE FROM AnswerOptions WHERE QuestionID IN (SELECT QuestionID FROM Questions WHERE SectionID IN (SELECT SectionID FROM Sections WHERE TestID = ?))", [$testID]);
sqlsrv_query($conn, "DELETE FROM Questions WHERE SectionID IN (SELECT SectionID FROM Sections WHERE TestID = ?)", [$testID]);
sqlsrv_query($conn, "DELETE FROM Sections WHERE TestID = ?", [$testID]);

foreach ($sections as $section) {
    $insertSection = sqlsrv_query($conn,
        "INSERT INTO Sections (TestID, SectionNumber, Duration, NumberOfQuestions, SectionTitle, Duration) OUTPUT INSERTED.SectionID VALUES (?, ?, ?, ?, ?, ?)",
        [$testID, $section["SectionNumber"], $section["Duration"], $section["NumberOfQuestions"], $section["SectionTitle"], $section["Duration"]]
    );
    if ($insertSection === false) die(print_r(sqlsrv_errors(), true));
    $row = sqlsrv_fetch_array($insertSection, SQLSRV_FETCH_ASSOC);
    $sectionID = $row["SectionID"];

    foreach ($section["Questions"] as $question) {
        $questionImage = null;
        if (isset($question["QuestionImage"]) && !empty($question["QuestionImage"])) {
            // إذا كانت الصورة مسارًا (ليست ملفًا جديدًا)، نستخدمها كما هي
            if (strpos($question["QuestionImage"], 'http') === 0 || strpos($question["QuestionImage"], 'data:image') === 0) {
                $questionImage = $question["QuestionImage"];
            }
        }

        $insertQ = sqlsrv_query($conn,
            "INSERT INTO Questions (SectionID, QuestionText, QuestionType, QuestionImage) OUTPUT INSERTED.QuestionID VALUES (?, ?, ?, ?)",
            [$sectionID, $question["QuestionText"], $question["QuestionType"], $questionImage]
        );
        if ($insertQ === false) die(print_r(sqlsrv_errors(), true));
        $qRow = sqlsrv_fetch_array($insertQ, SQLSRV_FETCH_ASSOC);
        $questionID = $qRow["QuestionID"];

        foreach ($question["Options"] as $opt) {
            $optionImage = null;
            if (isset($opt["OptionImage"]) && !empty($opt["OptionImage"])) {
                // إذا كانت الصورة مسارًا (ليست ملفًا جديدًا)، نستخدمها كما هي
                if (strpos($opt["OptionImage"], 'http') === 0 || strpos($opt["OptionImage"], 'data:image') === 0) {
                    $optionImage = $opt["OptionImage"];
                }
            }

            $insertOpt = sqlsrv_query($conn,
                "INSERT INTO AnswerOptions (QuestionID, OptionText, IsCorrect, OptionImage) VALUES (?, ?, ?, ?)",
                [$questionID, $opt["OptionText"], $opt["IsCorrect"] ? 1 : 0, $optionImage]
            );
            if ($insertOpt === false) die(print_r(sqlsrv_errors(), true));
        }
    }
}

echo "✅ Test updated successfully with images.";
?>