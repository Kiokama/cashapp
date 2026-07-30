package com.cashapp.repository;

import com.cashapp.model.Budget;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface BudgetRepository extends JpaRepository<Budget, String> {
    List<Budget> findBySpaceId(String spaceId);
    Optional<Budget> findBySpaceIdAndCategoryId(String spaceId, String categoryId);
}
